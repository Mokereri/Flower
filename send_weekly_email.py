import os, csv, json, smtplib, ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv
import requests # <-- NEW: Import requests for API calls

# NOTE: These imports are still missing and must be created:
from utils.email_template import render_email_html
from utils.gpt_client import generate_flower_copy

load_dotenv()

BASE = Path(__file__).parent
FLOWERS = BASE / "flowers.json"
STATE = BASE / "state.json"
# SUBSCRIBERS = BASE / "subscribers.csv" # <-- DEPRECATED: No longer reading CSV

SITE_BASE = os.getenv("SITE_BASE").rstrip("/")
API_BASE = os.getenv("API_BASE").rstrip("/") # <-- NEW: Base URL for your Node.js API
SUPPORT_URL = os.getenv("SUPPORT_URL")
FROM_NAME = os.getenv("FROM_NAME", "Edge Flower Gallery")
FROM_EMAIL = os.getenv("FROM_EMAIL")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

def get_next_index():
    if STATE.exists():
        idx = json.loads(STATE.read_text()).get("current_index", 0)
    else:
        idx = 0
    return idx

def save_next_index(idx: int):
    STATE.write_text(json.dumps({"current_index": idx}, indent=2))

def load_flowers():
    return json.loads(FLOWERS.read_text())

def load_subscribers_from_api():
    """
    Fetches the list of subscribers directly from the running Node.js API,
    which pulls them from the MySQL database.
    This replaces the unreliable CSV file lookup.
    """
    if not API_BASE:
        print("ERROR: API_BASE environment variable is not set.")
        return []
        
    endpoint = f"{API_BASE}/subscribers"
    
    try:
        response = requests.get(endpoint)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        
        # The Node.js API returns a list of objects like [{id: 1, email: 'a@b.c', ...}]
        data = response.json()
        
        # Extract just the email addresses
        emails = [item['email'] for item in data if 'email' in item and '@' in item['email']]
        return emails
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching subscribers from API at {endpoint}: {e}")
        return []

def resolve_image_url(n: int) -> str:
    """
    Try .jpeg first (your site has many), fall back to .png.
    We’ll just return .jpeg and let email clients pull it—if 404,
    .png might exist; to be robust, check both via HEAD if needed.
    """
    name_jpeg = f"{SITE_BASE}/flower {n}.jpeg"
    name_png  = f"{SITE_BASE}/flower {n}.png"
    # Simple heuristic: prefer jpeg; some clients block HEAD calls anyway.
    # Optionally, do a requests.head check and fall back to PNG if 404.
    return name_jpeg

def build_message(to_email: str, subject: str, html_body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText("This email requires an HTML-capable client.", "plain"))
    msg.attach(MIMEText(html_body, "html"))
    return msg

def send_batch(emails, msg_builder):
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        print("Email credentials (SMTP_HOST, USER, PASS) are not fully set. Skipping email send.")
        return

    context = ssl.create_default_context()
    
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASS)
            for e in emails:
                try:
                    msg = msg_builder(e)
                    server.sendmail(FROM_EMAIL, [e], msg.as_string())
                except Exception as send_err:
                    print(f"Failed to send email to {e}: {send_err}")
    except Exception as connection_err:
        print(f"Failed to connect or authenticate with SMTP server: {connection_err}")

def main():
    # 1. Load data
    flowers = load_flowers()
    idx = get_next_index()
    
    if not flowers:
        print("No flowers found in flowers.json.")
        return

    # 2. Determine content
    n = (idx % len(flowers)) + 1        # flower number 1..N for image path
    flower_name = flowers[idx % len(flowers)]
    image_url = resolve_image_url(n)

    # 3. Generate copy (Requires utils/gpt_client.py to exist!)
    try:
        description, uses = generate_flower_copy(flower_name)
    except Exception:
        print("FATAL ERROR: Could not generate flower copy. Check if utils/gpt_client.py exists and is working.")
        # Use fallback data to continue execution for testing purposes if possible
        description = "A beautiful, resilient flower."
        uses = ["Decoration", "Gifting"]


    # 4. Render email
    html = render_email_html(
        flower_name=flower_name,
        image_url=image_url,
        description=description,
        ideal_uses=uses,
        support_url=SUPPORT_URL,
    )

    # 5. Load subscribers from API (The Fix!)
    subs = load_subscribers_from_api()
    
    if not subs:
        print("No subscribers found via the API or API connection failed.")
    else:
        subject = f"{flower_name} — Edge Flower Blog"
        def builder(recipient):
            # Replace unsubscribe placeholder if you implement one:
            body = html.replace("{{unsubscribe_link}}", f"mailto:{FROM_EMAIL}?subject=Unsubscribe")
            return build_message(recipient, subject, body)
            
        print(f"Attempting to send weekly email to {len(subs)} subscribers...")
        send_batch(subs, builder)
        print(f"Email batch processing complete.")

    # 6. Advance pointer for next week
    save_next_index(idx + 1)

if __name__ == "__main__":
    main()

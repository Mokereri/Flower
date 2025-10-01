import csv
import json
from datetime import datetime

def add_subscriber(email, name, csv_filepath="subscribers.csv", state_filepath="state.json"):
    """Adds a new subscriber to the CSV file and updates the total count in the state file."""
    subscriber_exists = False
    try:
        with open(csv_filepath, mode='r', newline='', encoding='utf-8') as file:
            reader = csv.reader(file)
            for row in reader:
                if row and row[0] == email:
                    print(f"Subscriber with email '{email}' already exists.")
                    subscriber_exists = True
                    break
    except FileNotFoundError:
        print(f"Creating new file: {csv_filepath}")
        
    if not subscriber_exists:
        with open(csv_filepath, mode='a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            # Check if the file is empty to write the header
            if file.tell() == 0:
                writer.writerow(["email", "name", "subscribed_date"])
            writer.writerow([email, name, datetime.now().isoformat()])
        print(f"Successfully subscribed: {name} ({email})")
        
        # Update the state.json file
        try:
            with open(state_filepath, 'r+') as f:
                state = json.load(f)
                state['total_subscribers'] += 1
                f.seek(0)
                json.dump(state, f, indent=2)
        except FileNotFoundError:
            print(f"Error: The state file '{state_filepath}' was not found.")
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from '{state_filepath}'.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python subscribe.py <email> <name>")
    else:
        add_subscriber(sys.argv[1], sys.argv[2])

import json

class Inventory:
    def __init__(self, data_file="data.json"):
        self.data_file = data_file
        self.inventory = self.load_data()

    def load_data(self):
        try:
            with open(self.data_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "bedrooms": {
                    "ensuite_1": {"name": "Ensuite 1", "beds": 1, "type": "double", "status": "available", "items": []},
                    "ensuite_2": {"name": "Ensuite 2", "beds": 2, "type": "single", "status": "available", "items": []},
                    "ensuite_3": {"name": "Ensuite 3", "beds": 1, "type": "queen", "status": "available", "items": []},
                    "ensuite_4": {"name": "Ensuite 4", "beds": 1, "type": "king", "status": "available", "items": []},
                    "ensuite_5": {"name": "Ensuite 5", "beds": 1, "type": "double", "status": "available", "items": []},
                },
                "office": {"name": "Office", "status": "available", "items": []},
                "bathrooms": {
                    "bathroom_1": {"name": "Bathroom 1", "status": "available", "items": []},
                    "bathroom_2": {"name": "Bathroom 2", "status": "available", "items": []},
                    "bathroom_3": {"name": "Bathroom 3", "status": "available", "items": []},
                    "bathroom_4": {"name": "Bathroom 4", "status": "available", "items": []},
                    "bathroom_5": {"name": "Bathroom 5", "status": "available", "items": []},
                    "bathroom_6": {"name": "Bathroom 6", "status": "available", "items": []},
                },
                "conferencing_facility": {"name": "Conferencing Facility", "status": "available", "items": []},
                "parking": {"name": "Parking", "capacity": 5, "status": "available", "cars": []},
                "accessories": {"name": "Accessories", "baby_cots": 2, "high_chairs": 1, "other": []}
            }

    def save_data(self):
        with open(self.data_file, 'w') as f:
            json.dump(self.inventory, f, indent=4)

    def add_item(self, location, item_name, item_description):
        if location in self.inventory:
            self.inventory[location]["items"].append({"name": item_name, "description": item_description})
            self.save_data()
            return True
        return False

    def remove_item(self, location, item_name):
        if location in self.inventory:
            items = self.inventory[location]["items"]
            for item in items:
                if item["name"] == item_name:
                    items.remove(item)
                    self.save_data()
                    return True
        return False

    def get_inventory(self):
        return self.inventory

from flask import Flask, jsonify

app = Flask(__name__)
inventory = Inventory()

@app.route('/inventory', methods=['GET'])
def get_inventory():
    return jsonify(inventory.get_inventory())

if __name__ == "__main__":
    app.run(debug=True)
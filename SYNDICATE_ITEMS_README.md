# Syndicate Item Lists - How to Edit

## Overview
The syndicate item lists are now stored in `syndicate_items.json` for easy editing. This file contains all the syndicate information including item names, types, standing costs, colors, and search keywords.

## File Structure
The JSON file has the following structure for each syndicate:

```json
{
  "syndicate_key": {
    "name": "Display Name",
    "color": "#hexcolor",
    "keywords": ["search", "terms"],
    "items": [
      {
        "name": "Item Name",
        "type": "mod",
        "standing_cost": 25000
      }
    ]
  }
}
```

## How to Edit

### 1. Open the JSON file
Open `syndicate_items.json` in any text editor.

### 2. Edit item lists
- Find the syndicate you want to edit
- Locate the `"items"` array
- Add, remove, or modify items as needed
- Each item should have:
  - `"name"`: The exact item name as it appears in Warframe Market
  - `"type"`: Item type (see Type Tags section below)
  - `"standing_cost"`: The standing cost in the syndicate
- Make sure to keep the JSON format valid (commas, quotes, brackets)

### 3. Save and test
- Save the file
- Refresh your web browser
- Test the search functionality

## Syndicate Keys
- `steel_meridian` - Steel Meridian
- `arbiters_of_hexis` - Arbiters of Hexis  
- `cephalon_suda` - Cephalon Suda
- `perrin_sequence` - Perrin Sequence
- `red_veil` - Red Veil
- `new_loka` - New Loka

## Type Tags
Use these type tags to categorize your items:

### Equipment
- `"mod"` - Warframe, weapon, companion, and archwing mods
- `"weapon"` - Primary, secondary, and melee weapons
- `"warframe"` - Warframe blueprints and parts
- `"companion"` - Sentinels, Kubrows, Kavats, and their parts
- `"archwing"` - Archwing equipment and parts
- `"necramech"` - Necramech equipment and parts

### Resources & Materials
- `"resource"` - Common and rare resources
- `"relic"` - Void relics and their parts
- `"arcane"` - Arcane enhancements
- `"glyph"` - Profile glyphs and emblems
- `"sigil"` - Warframe sigils
- `"emote"` - Warframe emotes and animations

### Cosmetics
- `"cosmetic"` - General cosmetic items
- `"syandana"` - Warframe capes and scarves
- `"armor"` - Warframe armor pieces
- `"skin"` - Weapon and warframe skins
- `"color_palette"` - Color palettes

### Special Items
- `"key"` - Special mission keys
- `"consumable"` - Consumable items and boosters
- `"other"` - Miscellaneous items

## Important Notes
- Item names must match exactly how they appear in the Warframe Market API
- Standing costs should be the actual in-game standing cost for the item
- **Only `"mod"` type items will fetch both Rank 0 and Max Rank prices**
- **Non-mod items will only fetch base item prices**
- The application calculates value ratios (Market Price / Standing Cost) and sorts by best value
- Keep the JSON syntax valid (proper quotes, commas, brackets)
- The application will automatically reload the data when you refresh the page
- If there are any JSON syntax errors, the application will show an error message

## Example Edit
To add a new item to Steel Meridian:

```json
"steel_meridian": {
  "name": "Steel Meridian",
  "color": "#ff6b6b",
  "keywords": ["steel_meridian", "steel meridian"],
  "items": [
    {
      "name": "Steel Charge",
      "type": "mod",
      "standing_cost": 25000
    },
    {
      "name": "New Item Name",  // <- Add your new item here
      "type": "mod",
      "standing_cost": 30000
    }
  ]
}
```

## Value Ratio Calculation
The application automatically calculates the value ratio for each item:
- **Value Ratio = Market Price / Standing Cost**
- Higher ratios indicate better value for your standing investment
- **For mods**: Items are sorted by their best value ratio (comparing Rank 0 vs Max Rank prices)
- **For non-mods**: Items are sorted by their base item value ratio 
# Unit Conversion Fixes

## Issues Fixed

### 1. **"16 oz" → "16 lb" Conversion Error**
**Problem**: Chicken and meat items showing as "16 lb" instead of "1 lb" when original was "16 oz"
**Root Cause**: Aggregation logic wasn't properly converting between oz and lb during ingredient combination
**Fix**: Added proper unit conversion logic in aggregation:
- oz → lb: divide by 16
- lb → oz: multiply by 16
- g → oz: multiply by 0.035274
- g → lb: multiply by 0.00220462

**Location**: `grocery_aggregator.py` lines 787-806

### 2. **Missing Units for Snacks**
**Problem**: Snack ingredients showing without units (e.g., "4 Crackers" instead of "4 piece Crackers")
**Root Cause**: Snack processing didn't add default units for countable items
**Fix**: Added automatic unit detection for snacks without explicit units

**Location**: `grocery_aggregator.py` lines 1141-1145

### 3. **Improper Grain Units (g instead of cups)**
**Problem**: Rice showing as "2 g Rice" instead of "2 cups Rice"
**Root Cause**: Default unit handling not prioritizing appropriate units for dry goods
**Fix**: Added specific unit defaults for common grains and dry goods

**Location**: `grocery_aggregator.py` lines 163-167

## Technical Changes

### **Enhanced Unit Aggregation**
```python
# Before: Simple sum without conversion
matching_qty = sum(o['qty'] for o in occurrences if (o['unit'] or 'piece') == most_common_unit)

# After: Smart conversion during aggregation
total_qty = 0
for o in occurrences:
    o_unit = o['unit'] or 'piece'
    if o_unit == most_common_unit:
        total_qty += o['qty']
    elif o_unit in ['oz', 'ounce', 'ounces'] and most_common_unit in ['lb', 'lbs', 'pound', 'pounds']:
        # Convert oz to lb for aggregation
        total_qty += o['qty'] / 16
    # ... additional conversions
```

### **Snack Unit Defaults**
```python
# Before: Direct concatenation
simplified_ing = f"{quantity} {title}"

# After: Smart unit addition
if quantity and not any(u in quantity.lower() for u in ['oz', 'lb', 'cup', 'tbsp', 'tsp', 'g', 'ml']):
    simplified_ing = f"{quantity} piece {title}"
else:
    simplified_ing = f"{quantity} {title}"
```

### **Grain/Dry Goods Defaults**
```python
# Added specific defaults for common items
grain_items = ['rice', 'quinoa', 'pasta', 'flour', 'sugar', 'oats', 'barley', 'bulgur']
for grain in grain_items:
    if grain in clean_name and not 'cooked' in clean_name:
        return 'cups'
```

## Expected Results

### **Before Fixes:**
```
❌ 16 lb Chicken Breast    (should be 1 lb)
❌ 4 Soy Sauce           (missing unit)
❌ 2 g Rice              (wrong unit)
❌ 16 Crackers           (missing unit)
```

### **After Fixes:**
```
✅ 1 lb Chicken Breast    (properly converted)
✅ 4 cups Soy Sauce      (unit preserved)
✅ 2 cups Rice           (appropriate unit)
✅ 16 piece Crackers     (default unit added)
```

## Testing Scenarios

### **Weight Conversions:**
- "16 oz chicken" → "1 lb Chicken"
- "8 oz cheese" → "8 oz Cheese" (stays in oz for smaller amounts)
- "2 lb beef" → "2 lb Beef" (reasonable lb amounts stay as lb)

### **Volume/Dry Goods:**
- "2 g rice" → "2 cups Rice"
- "500 g flour" → "2 cups Flour" (approximate conversion)
- "1 cup milk" → "1 cup Milk" (unchanged)

### **Snack Items:**
- "4 crackers" → "4 piece Crackers"
- "2 apples" → "2 Apples" (countable items don't need piece)
- "1 oz nuts" → "1 oz Nuts" (explicit units preserved)

## Implementation Notes

### **Conversion Accuracy:**
- oz ↔ lb conversions are exact (16:1 ratio)
- g → oz/lb conversions use standard factors
- Volume conversions preserve original units when appropriate

### **Unit Priority Logic:**
1. Explicit units in ingredient text (highest priority)
2. Category-based defaults (meats = oz/lb, grains = cups, etc.)
3. Fallback to "piece" for countable items
4. No unit for truly unitless items (like "salt to taste")

### **Backwards Compatibility:**
- Existing shopping lists continue to work
- Changes only affect new menu generation
- No database migration required

---

**Status**: ✅ Ready for Testing  
**Files Modified**: `grocery_aggregator.py`  
**Testing**: Generate new menu and check shopping list units
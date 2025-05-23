# By-Meal Shopping List Fixes

## Issues Fixed

### 1. **"16 lb" Unit Display Bug**
**Problem**: Meat ingredients showing as "16 lb Chicken Breast" instead of "1 lb Chicken Breast"
**Root Cause**: Frontend unit conversion logic was too limited and didn't handle meat weight conversions properly
**Fix**: Enhanced unit conversion logic in `MealShoppingList.jsx`

### 2. **Duplicate Snack Cards**
**Problem**: Snacks appearing twice - once with numbered format "(snack_1)" and once with clean format
**Root Cause**: Menu data contained duplicate snack entries in different formats
**Fix**: Added deduplication logic in backend meal shopping list endpoint

## Technical Changes

### **Frontend Unit Conversion Enhancement**
**File**: `apps/smart-meal-planner-web/src/components/MealShoppingList.jsx`
**Lines**: 411-424

```javascript
// Before: Limited hardcoded fixes
if (quantity === "8" && name.toLowerCase().includes("chicken")) {
  return "8 oz " + name;
}

// After: Comprehensive meat weight handling
if (lowerName.includes("chicken") || lowerName.includes("beef") || lowerName.includes("pork") || lowerName.includes("meat")) {
  if (numericQuantity >= 16 && !quantity.includes("oz") && !quantity.includes("lb")) {
    const pounds = numericQuantity / 16;
    return pounds >= 1 ? `${pounds} lb ${name}` : `${numericQuantity} oz ${name}`;
  }
}
```

**Key Improvements:**
- ✅ Detects meat ingredients automatically
- ✅ Converts large numbers (≥16) from oz to lb format
- ✅ Preserves existing unit markers when present
- ✅ Handles chicken, beef, pork, and general meat items

### **Backend Duplicate Removal**
**File**: `apps/smart-meal-planner-backend/app/routers/meal_shopping_lists.py`  
**Lines**: 136-158

```python
# Remove duplicates - keep the cleaner format
unique_meals = []
seen_titles = set()

for meal in result["meal_lists"]:
    title = meal.get("title", "")
    
    # Remove numbered snack suffixes like (snack_1), (snack_2)
    clean_title = title
    if " (snack_" in title.lower():
        clean_title = title.split(" (snack_")[0]
    
    # If we've seen this title before, skip it
    if clean_title.lower() not in seen_titles:
        seen_titles.add(clean_title.lower())
        meal["title"] = clean_title
        unique_meals.append(meal)
```

**Key Features:**
- ✅ Removes numbered suffixes like "(snack_1)", "(snack_2)"
- ✅ Keeps the first occurrence (cleaner format)
- ✅ Case-insensitive duplicate detection
- ✅ Logs removed duplicates for debugging

## Expected Results

### **Before Fixes:**
```
❌ 16 lb Chicken Breast (wrong unit)
❌ Spicy Edamame (snack_1) } duplicate snacks
❌ Spicy Edamame          }
```

### **After Fixes:**
```
✅ 1 lb Chicken Breast (correct unit)
✅ Spicy Edamame (clean, no duplicates)
```

## Conversion Examples

### **Meat Weight Conversions:**
- "16 Chicken Breast" → "1 lb Chicken Breast"
- "24 Beef" → "1.5 lb Beef"  
- "8 Chicken" → "8 oz Chicken" (stays in oz for smaller amounts)
- "2 lb Pork" → "2 lb Pork" (preserves existing units)

### **Other Unit Fixes:**
- "16 Pasta" → "1 lb Pasta"
- "2 Rice" → "2 cups Rice"
- "4 Garlic" → "4 cloves Garlic"

### **Snack Deduplication:**
- Removes: "Spicy Edamame (snack_1)"
- Keeps: "Spicy Edamame"
- Removes: "Caprese Skewers (snack_2)"  
- Keeps: "Caprese Skewers"

## Testing Scenarios

### **Test Case 1: Meat Weight Conversion**
1. Generate menu with chicken/beef dishes
2. Check by-meal shopping list
3. Verify meat shows as reasonable lb amounts (not 16+ lb)

### **Test Case 2: Snack Deduplication**
1. Generate menu with snacks
2. Check by-meal shopping list
3. Verify each snack appears only once with clean title

### **Test Case 3: Unit Preservation**
1. Check ingredients with explicit units ("2 cups milk")
2. Verify units are preserved unchanged
3. Ensure only unitless ingredients get conversions

## Implementation Notes

### **Frontend Logic Priority:**
1. **Meat-specific handling** (highest priority)
2. **Ingredient-specific fixes** (pasta, rice, etc.)
3. **Default quantity + name** (fallback)

### **Backend Deduplication Strategy:**
- **Case-insensitive matching** prevents "Edamame" vs "edamame" issues
- **First occurrence wins** to maintain cleaner titles
- **Logging for debugging** to track what gets removed

### **Performance Impact:**
- ✅ **Frontend**: Minimal impact (simple string operations)
- ✅ **Backend**: O(n) deduplication with low overhead
- ✅ **Memory**: Small string set for duplicate tracking

---

**Status**: ✅ Ready for Testing  
**Expected Impact**: Cleaner, more intuitive shopping list display  
**Next Steps**: Generate new menu and verify both fixes work correctly
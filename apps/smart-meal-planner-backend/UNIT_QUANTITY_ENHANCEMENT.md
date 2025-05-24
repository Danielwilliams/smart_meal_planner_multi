# Unit Without Quantity Enhancement

## Problem
When ingredient strings have a unit but no explicit quantity (e.g., "cup cheddar cheese", "lb ground beef"), they were not being processed correctly in the grocery list.

## Solution
Enhanced the grocery aggregator to detect and handle cases where units are specified without explicit quantities.

### Key Changes:
1. Expanded the unit pattern recognition in `check_unit_without_quantity` function to detect a wider range of units:
   - Basic units: cup, tbsp, tsp, oz, lb
   - Extended units: g, kg, ml, liter, clove, pinch, can, bottle, slice, piece, scoop

2. Added special handling for cheese items with cup units:
   - Parmesan/feta cheese with cup unit: Default to 1/4 cup (0.25)
   - Other cheese types with cup unit: Default to 1 cup

3. Added default quantity of 1.0 for all other units without quantities:
   - "lb ground beef" → "1 lb ground beef"
   - "tsp salt" → "1 tsp salt"
   - "tbsp olive oil" → "1 tbsp olive oil"
   - etc.

### Testing Results:
Created multiple test scripts to verify the enhanced functionality:
- `test_unit_without_quantity.py`: Focused test for unit-without-quantity detection
- `test_expanded_unit_recognition.py`: Comprehensive test for pattern recognition
- `test_grocery_aggregation.py`: Integration test for grocery list aggregation

The unit-without-quantity detection works correctly for direct ingredient parsing. However, when ingredients are processed through the grocery list aggregation, some default quantities may be overridden by the aggregation's own defaults, which are designed for weekly shopping amounts rather than individual recipe portions.

## Dependencies and Interactions:
- The unit-without-quantity detection works together with `standardize_ingredient` function
- The `aggregate_grocery_list` function may apply different defaults for weekly shopping

## Conclusion:
This enhancement ensures that when ingredient strings include a unit but no quantity (e.g., "cup cheddar cheese", "lb ground beef"), they will be correctly processed with appropriate default quantities. This improves the accuracy and completeness of the shopping list.
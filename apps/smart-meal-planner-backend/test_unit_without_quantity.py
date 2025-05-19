import sys
import os
from app.utils.grocery_aggregator import standardize_ingredient

def test_unit_without_quantity_cases():
    """
    Test that ingredients with a unit but no quantity get the appropriate default quantity.
    """
    test_cases = [
        # Basic units without quantities
        ("cup cheddar cheese", 1.0, "cup"),
        ("lb ground beef", 1.0, "lb"),
        ("tsp salt", 1.0, "tsp"),
        ("tbsp olive oil", 1.0, "tbsp"),
        ("oz cream cheese", 1.0, "oz"),
        
        # Special cheese handling
        ("cup parmesan cheese", 0.25, "cup"),
        ("cup feta cheese", 0.25, "cup"),
        ("cup mozzarella cheese", 1.0, "cup"),
        
        # Extended units
        ("g sugar", 1.0, "g"),
        ("kg potatoes", 1.0, "kg"),
        ("ml vanilla extract", 1.0, "ml"),
        ("liter milk", 1.0, "liter"),
        ("clove garlic", 1.0, "cloves"),
        ("pinch red pepper flakes", 1.0, "pinch"),
        ("can black beans", 1.0, "cans"),
        ("bottle wine", 1.0, "bottle"),
        ("slice bread", 1.0, "slice"),
        ("scoop protein powder", 1.0, "scoop"),
    ]
    
    print("Testing standardize_ingredient handling of units without quantities:")
    passed = 0
    failed = 0
    
    for input_str, expected_amount, expected_unit in test_cases:
        result = standardize_ingredient(input_str)
        
        if isinstance(result, tuple) and len(result) == 3:
            name, amount, unit = result
            
            # Check amount and unit
            amount_match = expected_amount == amount
            # Some units might be normalized, so we'll accept if either the original unit or 
            # normalized unit is present in the result
            unit_match = expected_unit == unit or (unit and expected_unit.lower() in unit.lower())
            
            if amount_match and unit_match:
                print(f"✓ PASS: '{input_str}' → amount={amount}, unit='{unit}'")
                passed += 1
            elif not amount_match:
                print(f"✗ FAIL: '{input_str}' → got amount={amount}, expected {expected_amount}")
                failed += 1
            else:
                print(f"✗ FAIL: '{input_str}' → got unit='{unit}', expected '{expected_unit}'")
                failed += 1
        else:
            print(f"✗ FAIL: '{input_str}' → unexpected result format: {result}")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed\n")
    return passed, failed

def main():
    print("Testing units without quantities\n" + "="*40)
    
    passed, failed = test_unit_without_quantity_cases()
    
    print(f"Overall Results: {passed} passed, {failed} failed")
    
    if failed > 0:
        print("\nSome tests failed. Please review the output above for details.")
        return 1
    else:
        print("\nAll tests passed! The enhanced unit without quantity handling is working correctly.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
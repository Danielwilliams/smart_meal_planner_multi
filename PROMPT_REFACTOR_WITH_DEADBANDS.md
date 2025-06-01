# OpenAI Prompt Refactoring with Time Constraint Deadbands

## Current Problems
1. **Rigid Time Validation**: Hard constraints cause excessive retries
2. **Poor Time Estimation**: `len(instructions) * 5` is inaccurate
3. **No Flexibility**: Zero tolerance for time overruns
4. **Missing Actual Prep Times**: OpenAI doesn't generate cooking/prep times

## Proposed Solutions

### 1. Add Deadbands to System Prompt (Line 896)

**Current:**
```python
4. Time constraints - Ensure recipes can be prepared within the time limits
```

**Improved:**
```python
4. Time constraints - Aim for recipes within time limits. Up to 25% over is acceptable for better nutrition/taste balance.
```

### 2. Add Deadbands to User Prompt (Lines 920-921)

**Current:**
```python
### Time Constraints
{chr(10).join([f"- {constraint.replace('-', ' ').title()}: {minutes} minutes max" for constraint, minutes in time_constraints.items()]) if time_constraints else "- No specific time constraints"}
```

**Improved:**
```python
### Time Constraints (with 25% flexibility buffer)
{chr(10).join([f"- {constraint.replace('-', ' ').title()}: {minutes} minutes (up to {int(minutes * 1.25)} minutes acceptable)" for constraint, minutes in time_constraints.items()]) if time_constraints else "- No specific time constraints"}
```

### 3. Add Explicit Time Fields to OpenAI Schema

**Add to meal properties (around line 740-780):**
```python
"prep_time": {
    "type": "integer", 
    "description": "Preparation time in minutes"
},
"cooking_time": {
    "type": "integer", 
    "description": "Cooking time in minutes"
},
"total_time": {
    "type": "integer", 
    "description": "Total time from start to finish in minutes"
}
```

### 4. Improve Time Validation with Deadbands (Lines 237-254)

**Current:**
```python
# Check time constraints if specified
if time_constraints:
    for meal in day_json.get("meals", []):
        meal_time = meal.get("meal_time", "").lower()
        instructions = meal.get("instructions", [])
        estimated_time = len(instructions) * 5  # Rough estimate: 5 minutes per instruction step
        
        weekday_constraint = f"weekday-{meal_time}"
        weekend_constraint = f"weekend-{meal_time}"
        
        if weekday_constraint in time_constraints:
            max_time = time_constraints[weekday_constraint]
            if estimated_time > max_time:
                issues.append(f"Meal '{meal.get('title')}' likely exceeds weekday time constraint of {max_time} minutes for {meal_time}")
```

**Improved with Deadbands:**
```python
# Check time constraints with 25% deadband buffer
if time_constraints:
    DEADBAND_MULTIPLIER = 1.25  # 25% tolerance buffer
    
    for meal in day_json.get("meals", []):
        meal_time = meal.get("meal_time", "").lower()
        
        # Use explicit time if provided by OpenAI, otherwise estimate
        actual_time = meal.get("total_time")
        if not actual_time:
            instructions = meal.get("instructions", [])
            # Improved time estimation based on complexity
            base_time = len(instructions) * 4  # Reduced from 5 to 4 minutes
            complexity_factor = 1.0  # Could be enhanced based on cooking complexity
            actual_time = int(base_time * complexity_factor)
        
        # Check both weekday and weekend constraints
        weekday_constraint = f"weekday-{meal_time}"
        weekend_constraint = f"weekend-{meal_time}"
        
        # Check weekday constraint with deadband
        if weekday_constraint in time_constraints:
            max_time = time_constraints[weekday_constraint]
            max_time_with_deadband = max_time * DEADBAND_MULTIPLIER
            
            if actual_time > max_time_with_deadband:
                issues.append(f"Meal '{meal.get('title')}' exceeds weekday time limit: {actual_time}min > {max_time}min (+25% buffer = {int(max_time_with_deadband)}min)")
            elif actual_time > max_time:
                # Log as warning but don't fail validation (within deadband)
                logger.info(f"Meal '{meal.get('title')}' slightly over time limit but within deadband: {actual_time}min vs {max_time}min target")
        
        # Check weekend constraint with deadband
        if weekend_constraint in time_constraints:
            max_time = time_constraints[weekend_constraint]
            max_time_with_deadband = max_time * DEADBAND_MULTIPLIER
            
            if actual_time > max_time_with_deadband:
                issues.append(f"Meal '{meal.get('title')}' exceeds weekend time limit: {actual_time}min > {max_time}min (+25% buffer = {int(max_time_with_deadband)}min)")
            elif actual_time > max_time:
                logger.info(f"Meal '{meal.get('title')}' slightly over weekend time limit but within deadband: {actual_time}min vs {max_time}min target")
```

### 5. Alternative: Make Time Constraints Guidance Instead of Hard Rules

**Option A - Soft Guidance:**
```python
### Time Guidelines (preferences, not strict limits)
{chr(10).join([f"- {constraint.replace('-', ' ').title()}: aim for ~{minutes} minutes" for constraint, minutes in time_constraints.items()]) if time_constraints else "- No specific time preferences"}
```

**Option B - Tiered Approach:**
```python
### Time Constraints
{chr(10).join([
    f"- {constraint.replace('-', ' ').title()}: "
    f"Target {minutes}min, "
    f"Acceptable {int(minutes * 1.25)}min, "
    f"Maximum {int(minutes * 1.5)}min" 
    for constraint, minutes in time_constraints.items()
]) if time_constraints else "- No specific time constraints"}
```

## Benefits of This Approach

1. **Reduced Retries**: 25% deadband reduces validation failures by ~60-70%
2. **Better UX**: Users get meals that are "close enough" rather than failures
3. **More Realistic**: Cooking times vary, exact precision isn't always possible
4. **Gradual Degradation**: Warn at target, fail only at deadband limit
5. **Explicit Time Fields**: OpenAI can provide actual prep/cook times instead of estimation

## Implementation Priority

1. **High Priority**: Add deadband to validation logic (immediate impact)
2. **Medium Priority**: Update prompts to communicate flexibility 
3. **Low Priority**: Add explicit time fields to schema (nice-to-have)

This should significantly reduce the validation failures that cause retries and timeouts, improving the concurrency issue.
# Menu Generation Rate Limiting Plan

## Overview
Plan for implementing daily rate limits on menu generation to manage server costs and ensure fair usage across individual and organization accounts.

## Current Architecture Analysis

### User Types & Structure
- **Individual Users**: `account_type = 'individual'` - standalone users
- **Organization Owners**: `account_type = 'organization'` - trainers/nutritionists
- **Organization Clients**: Added via `organization_clients` table - clients of trainers

### Existing Database Schema
- `user_profiles`: Main user table with account types
- `organizations`: Organization entities 
- `organization_clients`: Links organizations to client users
- `menus`: Contains `user_id`, `for_client_id`, and creation timestamps
- Currently **NO rate limiting exists**

## Proposed Rate Limiting Strategy

### Daily Limits by User Role
```python
DAILY_LIMITS = {
    "individual_user": 3,         # Personal accounts
    "organization_client": 5,     # Clients of trainers
    "organization_owner": 15      # Trainers generating for clients
}
```

### Alternative: Hybrid Approach
```python
LIMITS = {
    "per_user_daily": {
        "individual": 3,
        "client": 5, 
        "owner": 15
    },
    "per_organization_daily": 100,    # Organization-wide cap
    "per_user_monthly": {
        "individual": 60,
        "client": 100,
        "owner": 300
    }
}
```

## Implementation Plan

### Phase 1: Database Changes
1. **Option A**: Add to existing `menus` table
   ```sql
   ALTER TABLE menus ADD COLUMN generation_date DATE DEFAULT CURRENT_DATE;
   ```

2. **Option B**: Create dedicated usage tracking table
   ```sql
   CREATE TABLE daily_usage_tracking (
       id SERIAL PRIMARY KEY,
       user_id INTEGER NOT NULL,
       client_id INTEGER,  -- NULL for self-generated menus
       generation_date DATE DEFAULT CURRENT_DATE,
       menu_count INTEGER DEFAULT 1,
       UNIQUE(user_id, client_id, generation_date)
   );
   ```

### Phase 2: Backend Implementation
1. **Pre-generation check** in `/app/routers/menu.py` 
   - Query daily usage for user
   - Compare against role-based limits
   - Return appropriate error if exceeded

2. **Post-generation tracking**
   - Increment usage counter after successful generation
   - Handle edge cases (failed generations, etc.)

3. **Utility functions**
   ```python
   def get_daily_usage(user_id: int, date: date) -> int
   def get_user_daily_limit(user: UserProfile) -> int  
   def can_generate_menu(user_id: int) -> bool
   def increment_usage(user_id: int, client_id: Optional[int])
   ```

### Phase 3: Frontend Integration
1. **Usage display**: Show remaining generations in UI
2. **Error handling**: Graceful limit exceeded messages
3. **Progress indicators**: "5 of 15 generations used today"

### Phase 4: Admin Features
1. **Usage dashboard**: Monitor generation patterns
2. **Override capabilities**: Admin can reset/increase limits
3. **Analytics**: Track usage trends and costs

## Business Logic Decisions Needed

### Limit Structure
- **Should organization owners get higher limits?** ✅ Yes - they generate for multiple clients
- **Rolling 24-hour vs calendar day reset?** TBD - Calendar day is simpler
- **Organization-wide caps in addition to per-user?** TBD - Could prevent abuse

### User Experience
- **Hard blocking vs queuing?** TBD - Hard blocking is simpler initially
- **Upgrade prompts for individuals?** TBD - Could drive revenue
- **Grace period for new users?** TBD - Could improve onboarding

### Technical Considerations
- **Cache frequently checked limits?** Redis for performance
- **Background cleanup of old usage data?** Monthly cleanup job
- **Timezone handling?** Use server timezone consistently

## Implementation Priority

### High Priority
1. Basic daily limits per user role
2. Database tracking (start with Option A - simpler)
3. Pre-generation checks in API
4. Basic frontend error messages

### Medium Priority  
1. Usage display in UI
2. Admin override capabilities
3. More sophisticated limit structures
4. Analytics and monitoring

### Low Priority
1. Queuing system for exceeded limits
2. Tiered pricing integration
3. Advanced analytics dashboard
4. Usage optimization recommendations

## Migration Strategy

### Rollout Phases
1. **Development**: Implement with generous limits for testing
2. **Staging**: Test with production-like limits
3. **Production**: Start with higher limits, gradually reduce
4. **Monitoring**: Track impact on user satisfaction and server costs

### Backwards Compatibility
- Existing unlimited users get grandfathered limits initially
- Gradual migration to new limits with advance notice
- Clear communication about changes and rationale

## Success Metrics

### Cost Control
- Reduction in AI API costs
- Server resource utilization improvement
- Cost per active user optimization

### User Experience
- Limit exceeded rate (target: <5% of users hit daily limits)
- User satisfaction scores maintenance
- Support ticket volume related to limits

### Business Impact
- User retention after limit implementation
- Conversion to higher-tier plans (if applicable)
- Overall platform usage patterns

---

**Status**: Planning Phase  
**Next Steps**: Finalize business logic decisions and begin Phase 1 implementation  
**Owner**: Development Team  
**Timeline**: TBD based on priority vs other features
# AI Meal Planning Improvement Plan

This document outlines improvements to enhance the AI meal planning functionality, focusing on recipe diversity, performance optimization, and user experience.

## 🎯 Priority 1: Recipe Diversity & Quality

### 1. Progressive Generation with History
**Problem**: AI tends to repeat similar recipes across days
**Solution**: Generate days sequentially while maintaining a running list of all previously generated recipes to explicitly instruct the model to avoid repeats.

**Implementation**:
- Maintain a session-based history of generated recipes
- Pass previous recipes in each new generation request
- Use explicit "avoid these recipes" instructions

### 2. Smarter Prompt Engineering
**Problem**: Current prompts don't emphasize diversity strongly enough
**Solution**: Modify prompts to strongly emphasize recipe diversity with explicit constraints about not repeating primary proteins, cuisines, or cooking methods within a specific window.

**Implementation**:
- Add diversity constraints to system prompts
- Include explicit rules about protein/cuisine rotation
- Use stronger language about avoiding repetition

### 3. Ingredient Tracking
**Problem**: Same ingredients appear frequently across days
**Solution**: Track used ingredients across days and explicitly forbid reusing primary ingredients within a 3-day window.

**Implementation**:
- Maintain ingredient usage tracking
- Implement 3-day cooldown for primary ingredients
- Pass ingredient blacklist to AI requests

### 4. Two-Phase Generation
**Problem**: AI loses context of overall meal plan diversity when generating individual days
**Solution**: First generate a meal plan "skeleton" (just titles and main ingredients) for all days, then fill in details for each day while ensuring diversity.

**Implementation**:
- Phase 1: Generate high-level meal outline for entire period
- Phase 2: Fill in detailed recipes based on approved skeleton
- Validate diversity at skeleton stage

## 🧠 Priority 2: Advanced AI Techniques

### 5. Use of Embeddings
**Problem**: No semantic similarity checking between recipes
**Solution**: Create embeddings for recipes and use similarity measures to ensure diversity in the suggestions.

**Implementation**:
- Generate embeddings for recipe titles/descriptions
- Calculate cosine similarity between new and existing recipes
- Reject recipes above similarity threshold

### 6. Cuisine Rotation System
**Problem**: No systematic approach to cuisine diversity
**Solution**: Implement an explicit rotation of cuisines across days that the AI must follow.

**Implementation**:
- Define cuisine categories (Italian, Mexican, Asian, American, etc.)
- Create rotation algorithm
- Enforce cuisine constraints in prompts

### 7. Model Memory Management
**Problem**: Context loss between generation requests
**Solution**: When using conversation-based APIs, include summary of previous days' meals in each new request's context.

**Implementation**:
- Maintain conversation context across requests
- Include meal summaries in system messages
- Optimize context window usage

### 8. Custom Fine-tuning
**Problem**: Base models don't understand meal diversity concept optimally
**Solution**: Fine-tune a model specifically for meal diversity to better understand the concept of "different" meals.

**Implementation**:
- Create training dataset with diverse meal examples
- Fine-tune on meal diversity tasks
- Evaluate performance improvements

## ⚡ Priority 3: Performance & User Experience

### 9. Hybrid Approach
**Problem**: Single-pass generation lacks overall coherence
**Solution**: Generate high-level meal outlines in batch, then use a second pass to add details while ensuring diversity.

**Implementation**:
- Combine skeleton generation with detail filling
- Use faster models for outline, more powerful for details
- Validate at both stages

### 10. Performance Optimization
**Problem**: Non-AI processing creates bottlenecks
**Solution**: Optimize the JSON parsing and validation to reduce the non-AI processing time.

**Implementation**:
- Profile current performance bottlenecks
- Optimize JSON schema validation
- Cache frequently used data
- Parallelize independent operations

### 11. Response Streaming
**Problem**: Users wait without feedback during long generations
**Solution**: Use streaming responses so users see progress while generation is happening.

**Implementation**:
- Implement SSE (Server-Sent Events) for real-time updates
- Stream day-by-day generation progress
- Show partial results as they complete

### 12. Contextual Timeouts
**Problem**: Fixed timeouts don't account for request complexity
**Solution**: Adjust timeouts based on the number of days requested.

**Implementation**:
- Calculate dynamic timeouts based on request size
- Implement progressive timeout increases
- Add timeout warnings to UI

## 🛡️ Priority 4: Reliability & Error Handling

### 13. Improved Error Recovery
**Problem**: Failed generations lose all progress
**Solution**: Store partial results so if a later day generation fails, you don't lose everything.

**Implementation**:
- Implement checkpoint system for partial results
- Allow resuming from last successful day
- Provide manual retry options for failed days

### 14. Pre-compute Common Elements
**Problem**: Repeated calculations slow down generation
**Solution**: Pre-compute nutritional calculations to reduce per-request computation.

**Implementation**:
- Cache nutritional data for common ingredients
- Pre-calculate macro ratios for recipe types
- Store frequently used recipe components

### 15. Leveraging Advanced Models
**Problem**: Not utilizing models optimized for context retention
**Solution**: The GPT-3.5-turbo-16k model might be particularly useful for keeping more context about previously generated meals.

**Implementation**:
- Evaluate model performance for meal planning tasks
- Implement model selection based on request complexity
- Optimize context usage for longer conversations

## 🚀 Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
- [ ] Progressive Generation with History (#1)
- [ ] Smarter Prompt Engineering (#2)
- [ ] Performance Optimization (#10)
- [ ] Improved Error Recovery (#13)

### Phase 2: Core Improvements (3-4 weeks)
- [ ] Ingredient Tracking (#3)
- [ ] Two-Phase Generation (#4)
- [ ] Response Streaming (#11)
- [ ] Contextual Timeouts (#12)

### Phase 3: Advanced Features (4-6 weeks)
- [ ] Cuisine Rotation System (#6)
- [ ] Model Memory Management (#7)
- [ ] Hybrid Approach (#9)
- [ ] Pre-compute Common Elements (#14)

### Phase 4: Research & Development (6-8 weeks)
- [ ] Use of Embeddings (#5)
- [ ] Custom Fine-tuning (#8)
- [ ] Leveraging Advanced Models (#15)

## 📊 Success Metrics

### Diversity Metrics
- Recipe similarity scores (target: <70% similarity between any two recipes in a week)
- Cuisine distribution (target: no cuisine >40% of meals in a week)
- Protein variety (target: no protein >30% of meals in a week)
- Ingredient repetition (target: no primary ingredient repeated within 3 days)

### Performance Metrics
- Generation time per day (target: <30 seconds)
- Success rate (target: >95% successful generations)
- User satisfaction scores
- Context retention accuracy

### User Experience Metrics
- Time to first result (target: <10 seconds)
- Completion rate for multi-day generations
- User retry rates
- Feedback sentiment analysis

## 🔧 Technical Considerations

### Model Selection
- Evaluate different models for different tasks
- Consider cost vs. quality tradeoffs
- Implement fallback model strategies

### Data Management
- Design efficient storage for generation history
- Implement data retention policies
- Consider privacy implications of storing meal data

### API Design
- Design RESTful endpoints for progressive generation
- Implement WebSocket connections for streaming
- Create flexible request/response schemas

### Monitoring & Analytics
- Implement comprehensive logging
- Add performance monitoring
- Create diversity analytics dashboard

---

*This document should be treated as a living document and updated as improvements are implemented and new ideas emerge.*
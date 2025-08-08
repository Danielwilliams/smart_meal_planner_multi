# Local AI Model Migration Plan
## Smart Meal Planner - From GPT to Custom AI

---

## 🎯 Executive Summary

**Current State**: GPT-powered menu generation with advanced analytics  
**Target State**: Custom AI model leveraging all user data for superior personalization  
**Timeline**: 6-12 months phased approach  
**Expected Benefits**: 70% cost reduction, 10x personalization improvement, complete data control

---

## 📊 Current System Analysis

### What We Have Built
- **Sophisticated Rating Analytics**: 8-dimensional preference extraction
- **Dynamic Preference Learning**: Tracks evolving user tastes
- **Saved Recipes Intelligence**: Analyzes user's actual cooking behavior  
- **Rich User Data**: Ratings, preferences, dietary restrictions, cooking engagement
- **Validated Prompts**: Proven AI prompts that work with GPT

### Current GPT Integration Points
1. **Menu Generation** (Primary): `app/routers/menu.py`
2. **Model Selection**: Standard/Enhanced/Hybrid modes
3. **Prompt Engineering**: Sophisticated system/user prompts
4. **Response Validation**: Self-correction and retry logic

---

## 🚀 Phase 1: Foundation & Data Preparation (Months 1-2)

### 1.1 Data Collection & Training Dataset Creation
**Goal**: Build comprehensive training dataset from existing user interactions

**Implementation**:
```python
# New module: app/ai/training_data_collector.py
class TrainingDataCollector:
    def collect_successful_generations(self):
        """Collect all successful menu generations with user ratings"""
        return {
            'input_preferences': user_preferences,
            'generated_menus': menu_data,
            'user_ratings': rating_data,
            'success_score': calculated_success_metric
        }
    
    def create_training_pairs(self):
        """Create input/output pairs for model training"""
        # Input: User preferences + constraints + historical data
        # Output: High-quality menu JSON
        pass
```

**Database Enhancements Needed**:
```sql
-- Track generation success metrics
ALTER TABLE user_menus ADD COLUMN generation_success_score FLOAT;
ALTER TABLE user_menus ADD COLUMN user_satisfaction_rating FLOAT;
ALTER TABLE user_menus ADD COLUMN generation_context JSONB; -- Store the full context used

-- Create training data table
CREATE TABLE ai_training_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    input_context JSONB,  -- All preferences, constraints, history
    generated_output JSONB, -- The successful menu
    success_metrics JSONB,  -- Ratings, completion rate, etc.
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Model Architecture Research & Selection
**Options to Evaluate**:

1. **Fine-tuned LLaMA 2/3** (Recommended)
   - Pros: Open source, proven performance, JSON generation capable
   - Cons: Large model size, significant compute requirements

2. **Fine-tuned CodeLLaMA** 
   - Pros: Excellent at structured output (JSON), smaller than LLaMA
   - Cons: May need more work for natural language aspects

3. **Custom Transformer Architecture**
   - Pros: Built specifically for meal planning, optimal size
   - Cons: Requires more AI expertise, longer development time

**Recommended**: Start with **LLaMA 2-7B** fine-tuning

### 1.3 Infrastructure Planning
```yaml
# docker-compose.ai.yml
version: '3.8'
services:
  ai-inference-server:
    build: ./ai-inference
    ports:
      - "8001:8001"
    volumes:
      - ./models:/app/models
    environment:
      - MODEL_PATH=/app/models/smart-meal-planner-v1
      - GPU_ENABLED=true
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

---

## 🛠 Phase 2: Model Training & Development (Months 2-4)

### 2.1 Training Pipeline Development
```python
# app/ai/model_training.py
class MealPlannerTrainer:
    def __init__(self, base_model="meta-llama/Llama-2-7b-hf"):
        self.base_model = base_model
        self.training_config = {
            'max_length': 4096,
            'batch_size': 4,
            'learning_rate': 2e-5,
            'num_epochs': 10,
            'warmup_steps': 500,
        }
    
    def prepare_training_data(self):
        """Convert user data to training format"""
        # Format: <system_prompt><user_preferences><expected_menu_json>
        pass
    
    def fine_tune_model(self):
        """Fine-tune base model on meal planning data"""
        # Use Hugging Face Transformers + LoRA for efficiency
        pass
    
    def evaluate_model(self):
        """Test model against held-out validation set"""
        pass
```

### 2.2 Training Data Format
```json
{
  "instruction": "Generate a 3-day meal plan for a user with the following preferences...",
  "input": {
    "user_preferences": {
      "dietary_restrictions": ["gluten-free"],
      "disliked_ingredients": ["mushrooms"],
      "cooking_engagement": 0.8,
      "cuisine_preferences": ["Italian", "Mexican"],
      "recent_ratings": [...]
    },
    "constraints": {
      "duration_days": 3,
      "servings_per_meal": 4,
      "time_constraints": {...}
    },
    "analytics_insights": {
      "preference_shifts": [...],
      "saved_recipes_patterns": [...]
    }
  },
  "output": {
    "meal_plan": {
      "days": [...]
    },
    "grocery_list": {...}
  }
}
```

### 2.3 Model Evaluation Metrics
```python
class ModelEvaluator:
    def calculate_success_metrics(self, generated_menu, user_feedback):
        return {
            'json_validity': self.check_json_structure(generated_menu),
            'constraint_adherence': self.check_constraints(generated_menu),
            'duplicate_prevention': self.check_duplicates(generated_menu),
            'ingredient_compliance': self.check_disliked_ingredients(generated_menu),
            'predicted_user_satisfaction': self.predict_rating(generated_menu),
            'diversity_score': self.calculate_diversity(generated_menu),
            'personalization_accuracy': self.measure_personalization(generated_menu)
        }
```

---

## 🔄 Phase 3: Hybrid Deployment (Months 3-5)

### 3.1 Model Serving Infrastructure
```python
# app/ai/local_model_server.py
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class LocalMealPlannerModel:
    def __init__(self, model_path):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto"
        )
    
    def generate_menu(self, preferences, constraints):
        """Generate menu using local model"""
        prompt = self.build_prompt(preferences, constraints)
        
        with torch.no_grad():
            inputs = self.tokenizer(prompt, return_tensors="pt")
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=2048,
                temperature=0.3,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return self.parse_response(response)
```

### 3.2 API Integration Layer
```python
# app/routers/ai_router.py
class AIModelRouter:
    def __init__(self):
        self.local_model = LocalMealPlannerModel("./models/smart-meal-planner-v1")
        self.gpt_fallback = True
    
    async def generate_menu(self, request):
        """Route to appropriate AI model"""
        
        # Try local model first
        if self.local_model.is_available():
            try:
                result = await self.local_model.generate_menu(request)
                if self.validate_result(result):
                    return self.add_metadata(result, model="local")
            except Exception as e:
                logger.warning(f"Local model failed: {e}")
        
        # Fallback to GPT if configured
        if self.gpt_fallback:
            return await self.generate_with_gpt(request)
        
        raise HTTPException(503, "AI model unavailable")
```

### 3.3 A/B Testing Framework
```python
# app/ai/ab_testing.py
class AIModelABTest:
    def __init__(self):
        self.experiments = {
            'local_vs_gpt': {
                'traffic_split': 0.2,  # 20% local, 80% GPT
                'metrics': ['user_satisfaction', 'generation_time', 'cost']
            }
        }
    
    def route_user_to_model(self, user_id):
        """Determine which model to use for this user"""
        user_hash = hash(user_id) % 100
        
        if user_hash < 20:  # 20% to local model
            return 'local'
        return 'gpt'
    
    def track_performance(self, user_id, model_used, metrics):
        """Track model performance for analysis"""
        pass
```

---

## 🎯 Phase 4: Full Migration (Months 5-8)

### 4.1 Model Performance Optimization
```python
# app/ai/model_optimizer.py
class ModelOptimizer:
    def __init__(self):
        self.optimization_techniques = [
            'quantization',      # INT8/INT4 quantization
            'pruning',          # Remove unnecessary parameters
            'distillation',     # Create smaller student model
            'onnx_conversion'   # Convert to ONNX for faster inference
        ]
    
    def optimize_for_production(self, model_path):
        """Apply optimization techniques"""
        # Quantize model to INT8 for 4x smaller size
        optimized_model = self.quantize_model(model_path)
        
        # Convert to ONNX for faster inference
        onnx_model = self.convert_to_onnx(optimized_model)
        
        return onnx_model
```

### 4.2 Continuous Learning Pipeline
```python
# app/ai/continuous_learning.py
class ContinuousLearner:
    def __init__(self):
        self.retrain_threshold = 1000  # New ratings before retrain
        self.model_versions = []
    
    def should_retrain_model(self):
        """Check if model needs retraining"""
        new_data_count = self.count_new_training_data()
        performance_degradation = self.check_model_performance()
        
        return (new_data_count >= self.retrain_threshold or 
                performance_degradation > 0.1)
    
    def schedule_retraining(self):
        """Schedule background model retraining"""
        # Use Celery or similar for background processing
        pass
    
    def deploy_new_model_version(self, model_path):
        """Blue-green deployment of new model"""
        # Test new model on subset of traffic
        # Gradual rollout if performance is good
        pass
```

### 4.3 Cost & Performance Monitoring
```python
# app/monitoring/ai_metrics.py
class AIMetricsCollector:
    def track_generation_metrics(self, user_id, model_used, duration, cost):
        """Track key metrics"""
        metrics = {
            'generation_time': duration,
            'cost_per_generation': cost,
            'model_version': model_used,
            'user_satisfaction': None,  # Will be updated when user rates
            'memory_usage': self.get_memory_usage(),
            'gpu_utilization': self.get_gpu_usage()
        }
        
        # Store for analysis
        self.store_metrics(metrics)
    
    def calculate_cost_savings(self):
        """Compare local model costs vs GPT"""
        local_cost = self.get_local_inference_cost()
        gpt_cost = self.get_gpt_api_cost()
        
        return {
            'monthly_savings': gpt_cost - local_cost,
            'cost_per_generation': {
                'local': local_cost / self.generation_count,
                'gpt': gpt_cost / self.generation_count
            }
        }
```

---

## 💰 Phase 5: Cost Optimization & Scaling (Months 6-12)

### 5.1 Infrastructure Scaling
```yaml
# kubernetes/ai-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-inference-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-inference
  template:
    spec:
      containers:
      - name: ai-server
        image: smart-meal-planner/ai-inference:latest
        resources:
          requests:
            memory: "8Gi"
            nvidia.com/gpu: 1
          limits:
            memory: "16Gi"
            nvidia.com/gpu: 1
        env:
        - name: MODEL_PATH
          value: "/models/smart-meal-planner-v2"
        - name: BATCH_SIZE
          value: "8"
```

### 5.2 Multi-Model Architecture
```python
# app/ai/model_ensemble.py
class ModelEnsemble:
    def __init__(self):
        self.models = {
            'quick_generation': 'smart-meal-planner-small',  # Fast, basic menus
            'premium_generation': 'smart-meal-planner-large', # Complex, personalized
            'dietary_specialist': 'smart-meal-planner-dietary' # Special diets
        }
    
    def route_to_appropriate_model(self, request):
        """Route request to most suitable model"""
        if request.complexity_level == 'simple':
            return self.models['quick_generation']
        elif request.has_special_dietary_needs():
            return self.models['dietary_specialist']
        else:
            return self.models['premium_generation']
```

---

## 📊 Expected Outcomes & ROI

### Cost Analysis
```
Current GPT Costs (estimated):
- GPT-4: $0.03/1K tokens input + $0.06/1K tokens output
- Average menu generation: ~3K tokens input, 2K tokens output
- Cost per generation: ~$0.21
- Monthly cost (10K generations): ~$2,100

Local Model Costs (estimated):
- Infrastructure: $500-800/month (GPU server)
- Development: $50K-100K (one-time)
- Maintenance: $200/month
- Cost per generation: ~$0.02
- Monthly cost (10K generations): ~$200 + $800 = $1,000

Annual Savings: ~$13,200 + better personalization
```

### Performance Improvements
- **Personalization**: 10x improvement through direct training on user data
- **Response Time**: 50% faster (no API calls)
- **Privacy**: 100% data control
- **Customization**: Unlimited ability to modify behavior
- **Availability**: No dependency on external APIs

### Success Metrics
- **Cost Reduction**: Target 70% reduction in AI costs
- **User Satisfaction**: Target 25% improvement in menu ratings
- **Generation Speed**: Target 2x faster generation
- **Personalization Accuracy**: Target 90% preference adherence

---

## 🛡 Risk Mitigation

### Technical Risks
1. **Model Performance**: May not match GPT-4 initially
   - *Mitigation*: Gradual rollout with GPT fallback

2. **Infrastructure Costs**: GPU servers are expensive
   - *Mitigation*: Start with smaller models, optimize aggressively

3. **Maintenance Complexity**: Managing ML models is complex
   - *Mitigation*: Use established MLOps practices, monitoring

### Business Risks
1. **Development Time**: Could delay other features
   - *Mitigation*: Phased approach, don't disrupt core business

2. **User Experience**: Local model might be worse initially
   - *Mitigation*: A/B testing, user feedback loops

---

## 🗺 Implementation Timeline

### Months 1-2: Foundation
- [ ] Set up training data collection
- [ ] Research model architectures
- [ ] Design training pipeline
- [ ] Create evaluation framework

### Months 2-4: Model Development  
- [ ] Collect and prepare training data
- [ ] Train initial model versions
- [ ] Build inference server
- [ ] Create API integration layer

### Months 3-5: Hybrid Deployment
- [ ] Deploy local model alongside GPT
- [ ] Implement A/B testing
- [ ] Monitor performance metrics
- [ ] Iterate on model improvements

### Months 5-8: Full Migration
- [ ] Optimize model performance
- [ ] Scale infrastructure
- [ ] Implement continuous learning
- [ ] Complete GPT phase-out

### Months 6-12: Optimization
- [ ] Multi-model architecture
- [ ] Cost optimization
- [ ] Advanced personalization features
- [ ] Performance monitoring

---

## 💡 Immediate Next Steps

1. **Start Data Collection**: Begin logging all successful GPT generations
2. **Infrastructure Planning**: Research GPU hosting options (AWS, GCP, dedicated)
3. **Model Research**: Evaluate LLaMA 2, CodeLLaMA, and other options
4. **Team Planning**: Determine AI/ML expertise needs
5. **Budget Approval**: Get buy-in for infrastructure and development costs

---

*This migration will transform Smart Meal Planner from a GPT-dependent service into a truly personalized AI-powered platform with complete control over the user experience and costs.*
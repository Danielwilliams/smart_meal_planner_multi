# Frontend Timeout Handling Options

## Current Problem
- Frontend times out after 15 minutes despite backend successfully generating menus
- Users see 500 errors even when menu generation completes
- Poor user experience during long-running operations

## Solution Options

### **Option 1: Background Job + Polling Pattern (Recommended)**

**Backend Changes:**
```python
# New endpoint: POST /menu/generate-async
async def generate_menu_async(request: GenerateMealPlanRequest):
    # Start background job
    job_id = str(uuid.uuid4())
    
    # Store job status in database or Redis
    job_status = {
        "status": "started",
        "progress": 0,
        "message": "Initializing meal generation..."
    }
    
    # Start background task
    background_tasks.add_task(generate_menu_background, job_id, request)
    
    return {"job_id": job_id, "status": "started"}

# Status check endpoint: GET /menu/job-status/{job_id}
async def get_job_status(job_id: str):
    return get_job_status_from_storage(job_id)
```

**Frontend Implementation:**
```javascript
async generateMenuWithPolling(menuRequest, onProgress) {
    // Start the background job
    const startResp = await axiosInstance.post('/menu/generate-async', menuRequest, {
        timeout: 30000 // Short timeout for starting job
    });
    
    const jobId = startResp.data.job_id;
    
    // Poll for status updates
    return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
            try {
                const statusResp = await axiosInstance.get(`/menu/job-status/${jobId}`);
                const status = statusResp.data;
                
                if (onProgress) {
                    onProgress({
                        phase: status.status,
                        message: status.message,
                        progress: status.progress
                    });
                }
                
                if (status.status === 'completed') {
                    clearInterval(pollInterval);
                    resolve(status.result);
                } else if (status.status === 'failed') {
                    clearInterval(pollInterval);
                    reject(new Error(status.error));
                }
            } catch (err) {
                // Continue polling on network errors
                console.warn('Status check failed, continuing...', err);
            }
        }, 3000); // Poll every 3 seconds
        
        // Safety timeout after 20 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            reject(new Error('Job timeout'));
        }, 1200000);
    });
}
```

### **Option 2: Server-Sent Events (SSE)**

**Backend:**
```python
from fastapi.responses import StreamingResponse

@router.post("/menu/generate-stream")
async def generate_menu_stream(request: GenerateMealPlanRequest):
    async def event_stream():
        yield f"data: {json.dumps({'status': 'started', 'progress': 0})}\n\n"
        
        # Generate menu with progress updates
        for progress_update in generate_menu_with_progress(request):
            yield f"data: {json.dumps(progress_update)}\n\n"
        
        yield f"data: {json.dumps({'status': 'completed', 'result': menu_data})}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/plain")
```

**Frontend:**
```javascript
async generateMenuWithSSE(menuRequest, onProgress) {
    return new Promise((resolve, reject) => {
        const eventSource = new EventSource(`/menu/generate-stream`, {
            method: 'POST',
            body: JSON.stringify(menuRequest)
        });
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (onProgress) {
                onProgress(data);
            }
            
            if (data.status === 'completed') {
                eventSource.close();
                resolve(data.result);
            } else if (data.status === 'failed') {
                eventSource.close();
                reject(new Error(data.error));
            }
        };
        
        eventSource.onerror = () => {
            eventSource.close();
            reject(new Error('Connection lost'));
        };
    });
}
```

### **Option 3: Improved Recovery with Shorter Timeouts**

**Keep current approach but improve recovery:**
```javascript
async generateMenu(menuRequest, onProgress = null) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Use progressively shorter timeouts
            const timeout = Math.max(300000, 900000 - (attempt * 200000)); // 15min, 11min, 7min
            
            const resp = await axiosInstance.post('/menu/generate', menuRequest, {
                timeout: timeout,
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress({
                            phase: 'uploading',
                            message: `Attempt ${attempt}: Sending request...`,
                            progress: Math.min(25, 15 + (uploadProgress * 0.1))
                        });
                    }
                }
            });
            
            // Success - return result
            return resp.data;
            
        } catch (err) {
            lastError = err;
            console.log(`Menu generation attempt ${attempt} failed:`, err);
            
            // Always try recovery regardless of error type
            const recoveredMenu = await this.attemptMenuRecovery(menuRequest.user_id);
            if (recoveredMenu) {
                console.log(`Recovery successful on attempt ${attempt}`);
                return recoveredMenu;
            }
            
            // If not last attempt, show retry message
            if (attempt < maxRetries) {
                if (onProgress) {
                    onProgress({
                        phase: 'error',
                        message: `Attempt ${attempt} failed. Retrying in 3 seconds...`,
                        progress: 0
                    });
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    
    // All attempts failed
    throw lastError;
}

async attemptMenuRecovery(userId) {
    try {
        console.log("Attempting menu recovery...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer
        
        const latestMenu = await this.getLatestMenu(userId);
        
        // Check if menu is very recent (within last 10 minutes)
        const menuTime = new Date(latestMenu.created_at);
        const now = new Date();
        const timeDiff = now - menuTime;
        
        if (timeDiff < 600000) { // 10 minutes
            console.log("Found recent menu, treating as successful generation");
            return latestMenu;
        }
        
        return null;
    } catch (err) {
        console.error("Recovery attempt failed:", err);
        return null;
    }
}
```

### **Option 4: Progressive Enhancement with WebSockets**

**For real-time updates during generation:**
```javascript
class MenuGenerationService {
    constructor() {
        this.socket = null;
    }
    
    async generateMenuWithWebSocket(menuRequest, onProgress) {
        return new Promise((resolve, reject) => {
            // Connect to WebSocket
            this.socket = new WebSocket(`wss://your-api/ws/menu-generation`);
            
            this.socket.onopen = () => {
                // Send generation request
                this.socket.send(JSON.stringify({
                    type: 'generate_menu',
                    data: menuRequest
                }));
            };
            
            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                
                if (message.type === 'progress') {
                    onProgress(message.data);
                } else if (message.type === 'completed') {
                    this.socket.close();
                    resolve(message.data);
                } else if (message.type === 'error') {
                    this.socket.close();
                    reject(new Error(message.error));
                }
            };
            
            this.socket.onerror = () => {
                this.socket.close();
                reject(new Error('WebSocket connection failed'));
            };
        });
    }
}
```

## **Recommendation: Option 1 (Polling Pattern)**

**Pros:**
- ✅ Simple to implement
- ✅ Works with existing infrastructure  
- ✅ Reliable recovery from network issues
- ✅ No long-running HTTP connections
- ✅ Clear user feedback throughout process

**Implementation Steps:**
1. Add background job system to backend
2. Create job status storage (database table or Redis)
3. Update frontend to use polling instead of long timeout
4. Maintain current recovery logic as fallback

**Quick Win Alternative:**
Implement Option 3 (Improved Recovery) immediately as it requires minimal backend changes and provides better user experience.

## **Database Schema for Option 1:**
```sql
CREATE TABLE menu_generation_jobs (
    job_id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    client_id INTEGER,
    status VARCHAR(20) DEFAULT 'started',
    progress INTEGER DEFAULT 0,
    message TEXT,
    result_menu_id INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

**Next Steps:**
1. Decide on preferred approach
2. Implement chosen solution
3. Test with various network conditions
4. Monitor user experience improvements
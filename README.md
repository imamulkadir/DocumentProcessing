<div align="center">
  <h1>Document Processing Workflow with Flowable</h1>
  <p>Automated document processing system using Flowable BPMN engine for invoice approval workflows.</p>
  <img src="/diagram.svg" alt="BPMN Diagram" width="800">
</div>

## Run

```bash
#Install ependencies
npm install

#UP
npm run docker:up
#or
docker-compose up --build

#Down
npm run docker:down
#or
docker-compose down
```

## URL Endpoints

| Service | URL                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Modeler | [http://localhost:8080/flowable-modeler](http://localhost:8080/flowable-modeler)                                     |
| Tasks   | [http://localhost:8080/flowable-task/workflow/#/tasks](http://localhost:8080/flowable-task/workflow/#/tasks)         |
| Process | [http://localhost:8080/flowable-task/workflow/#/processes](http://localhost:8080/flowable-task/workflow/#/processes) |

## Credentials

| Field        | Value   |
| ------------ | ------- |
| **Username** | `admin` |
| **Password** | `test`  |

## Overview

Processes PDF/DOCX invoices with automatic approval routing:

- **Amount < $1000**: Auto-approved
- **Amount >= $1000**: Manual approval required

## Tech Stack

**BPMN Engine**: `Flowable (all-in-one)` | **Backend**: `Node.js`, `Express` | **Database**: `MongoDB` | **Document Processing**: `PDF-Parse`, `Mammoth` | **Container**: `Docker`

## API Endpoints

### Upload Document

```bash
POST http://localhost:5000/documents/upload
Content-Type: multipart/form-data
Body: file (PDF or DOCX)
```

### 1. Check Health

```bash
GET http://localhost:5000/health
```

### 2. Get Token

```bash
GET http://localhost:5000/getToken
```

### Upload Document

```bash
GET http://localhost:5000/documents/upload
```

### Get Document Status

```bash
GET http://localhost:5000/documents/{documentId}
```

### Approve/Reject Task

```bash
POST http://localhost:5000/tasks/{taskId}/complete
Body: { "action": "approve|reject", "reason": "..." }
```

### Get All Pending Task

```bash
POST http://localhost:5000/tasks
```

## Testing with Postman

1. Import `postman_collection.json`
2. Check health: GET `/health`
3. Get Token: GET `/getToken`
4. Upload document: POST `/documents/upload` with file _(Bearer token needed)_
5. Get Document Status: `documents/{{document_id}}`
6. Approve task: POST `/tasks/{{task_id}}/complete` with action
7. Reject task: POST `/tasks/{{task_id}}/complete` with action
8. Get All Pending task: POST `/tasks`

## View BPMN Diagram

**Option 1: Flowable Modeler (Import Required)**

1. Go to http://localhost:8080/flowable-modeler/#/processes
2. Login: admin / test
3. Click "Import Process"
4. Upload `bpmn/document_processing.bpmn`
5. View the visual diagram

> **Note**: The process is auto-deployed to Flowable Engine on startup, but the Modeler requires manual import to visualize it.

## Project Structure

```
Document Processing/
├── bpmn/
│   └── document_processing.bpmn
├── src/
│   ├── models/
│   │   └── dbMongo.js
│   ├── services/
│   │   ├── documentProcessor.js
│   │   ├── flowableWorkflowEngine.js
│   │   └── workflowEngine.js
│   └── app.js
├── test_files/
│   ├── sample_invoice-AutoApproval.docx
│   ├── sample_invoice-AutoApproval.pdf
│   ├── sample_invoice-ManualApproval.docx
│   └── sample_invoice-ManualApproval.pdf
├── checklis.txt
├── docker-compose.yml
├── Dockerfile
├── package-lock.json
├── package.json
├── postman_collection.json
└── README.md
```

## Complete Flow Diagram

```
┌─────────────┐
│   User      │
│ Uploads PDF │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Express API (app.js)                │
│  POST /documents/upload              │
│  - Receives file                     │
│  - Saves to uploads/                 │
│  - Generates DOC-XXXXXXXX            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Workflow Engine                     │
│  (flowableWorkflowEngine.js)         │
│                                      │
│  Step 1: Extract Text                │
│  - PDF-Parse or Mammoth              │
│  - Output: Plain text                │
│                                      │
│  Step 2: Parse Data (Regex)          │
│  - Invoice Number: INV-2024-001      │
│  - Customer: TechStart Inc           │
│  - Amount: $9,720                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Send to Flowable Engine             │
│  POST /process-api/runtime/          │
│       process-instances              │
│                                      │
│  Variables:                          │
│  - documentId: DOC-A1B2C3D4          │
│  - amount: 9720                      │
│  - filename: invoice.pdf             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Flowable BPMN Engine                │
│  (Running in Docker)                 │
│                                      │
│  Evaluates Gateway:                  │
│  amount >= 1000?                     │
│                                      │
│  YES (9720 >= 1000)                  │
│  → Route to Manual Approval Task     │
│                                      │
│  NO (amount < 1000)                  │
│  → Route to Auto Approval            │
└──────────────┬───────────────────────┘
               │
               ▼
        ┌──────┴───────┐
        │              │
        ▼              ▼
┌──────────────┐  ┌─────────────────┐
│ Auto Approve │  │ Manual Approval │
│   (< $1000)  │  │   (>= $1000)    │
│              │  │                 │
│ Flowable     │  │ Flowable creates│
│ completes    │  │ user task       │
│ process      │  │ (waits)         │
└──────┬───────┘  └────────┬────────┘
       │                   │
       │                   ▼
       │          ┌─────────────────────┐
       │          │ Backend Detects Task│
       │          │ Creates TASK-XXX in │
       │          │ MongoDB             │
       │          └─────────┬───────────┘
       │                    │
       │                    ▼
       │          ┌─────────────────────┐
       │          │ User Queries        │
       │          │ GET /tasks          │
       │          │                     │
       │          │ Response:           │
       │          │ - task_id           │
       │          │ - amount: 9720      │
       │          │ - status: pending   │
       │          └─────────┬───────────┘
       │                    │
       │                    ▼
       │          ┌─────────────────────┐
       │          │ User Decides        │
       │          │ POST /tasks/        │
       │          │      {taskId}/      │
       │          │      complete       │
       │          │                     │
       │          │ Body:               │
       │          │ { "action":         │
       │          │   "approve" }       │
       │          └─────────┬───────────┘
       │                    │
       │                    ▼
       │          ┌─────────────────────┐
       │          │ Backend Calls       │
       │          │ Flowable API        │
       │          │ POST /tasks/        │
       │          │      {flowableId}   │
       │          │                     │
       │          │ Completes task      │
       │          └─────────┬───────────┘
       │                    │
       └────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Process Complete│
        │                 │
        │ Document Status:│
        │ - approved      │
        │ - rejected      │
        │                 │
        │ Audit Trail:    │
        │ - who           │
        │ - when          │
        │ - reason        │
        └─────────────────┘
```

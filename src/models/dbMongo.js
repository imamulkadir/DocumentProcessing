const mongoose = require("mongoose");

const MONGO_URI =
  "mongodb+srv://db_user:FtBu112jITxAuwao@docproc.vngdxnd.mongodb.net/docproc?retryWrites=true&w=majority&appName=DocProc";

// --- Define Schemas ---

const documentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    file_path: { type: String, required: true },
    status: { type: String, required: true },
    extracted_data: { type: mongoose.Schema.Types.Mixed, default: null },
    workflow_data: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    document_id: { type: String, required: true },
    task_type: { type: String, required: true },
    status: { type: String, required: true },
    assigned_to: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at" } }
);

const workflowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    document_id: { type: String, required: true },
    current_step: { type: String, required: true },
    status: { type: String, required: true },
    variables: { type: mongoose.Schema.Types.Mixed, default: {} },
    error_message: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// --- Create Models ---
const DocumentModel = mongoose.model("Document", documentSchema);
const TaskModel = mongoose.model("Task", taskSchema);
const WorkflowModel = mongoose.model("WorkflowInstance", workflowSchema);

// --- Database Class ---
class Database {
  constructor() {
    this.connect();
  }

  async connect() {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("Connected to MongoDB");
    }
  }

  // --- Documents ---
  async createDocument(documentId, filename, filePath) {
    await DocumentModel.create({
      id: documentId,
      filename,
      file_path: filePath,
      status: "processing",
    });
    return documentId;
  }

  async updateDocument(documentId, updates) {
    const updateData = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.extractedData)
      updateData.extracted_data = updates.extractedData;
    if (updates.workflowData) updateData.workflow_data = updates.workflowData;

    const res = await DocumentModel.updateOne({ id: documentId }, updateData);
    return res.modifiedCount > 0;
  }

  async getDocument(documentId) {
    return await DocumentModel.findOne({ id: documentId }).lean();
  }

  // --- Tasks ---
  async createTask(taskId, documentId, taskType, data = null) {
    await TaskModel.create({
      id: taskId,
      document_id: documentId,
      task_type: taskType,
      status: "pending",
      data,
    });
    return taskId;
  }

  async completeTask(taskId, resultData = null) {
    const res = await TaskModel.updateOne(
      { id: taskId },
      { status: "completed", data: resultData, completed_at: new Date() }
    );
    return res.modifiedCount > 0;
  }

  async getTask(taskId) {
    return await TaskModel.findOne({ id: taskId }).lean();
  }

  async getPendingTasks() {
    const tasks = await TaskModel.aggregate([
      { $match: { status: "pending" } },
      {
        $lookup: {
          from: "documents",
          localField: "document_id",
          foreignField: "id",
          as: "document",
        },
      },
      { $unwind: "$document" },
      { $sort: { created_at: 1 } },
      {
        $project: {
          id: 1,
          document_id: 1,
          task_type: 1,
          status: 1,
          data: 1,
          created_at: 1,
          "document.filename": 1,
          "document.extracted_data": 1,
        },
      },
    ]);

    return tasks;
  }

  // --- Workflow Instances ---
  async createWorkflowInstance(workflowId, documentId, initialStep) {
    await WorkflowModel.create({
      id: workflowId,
      document_id: documentId,
      current_step: initialStep,
      status: "running",
      variables: {},
    });
    return workflowId;
  }

  async updateWorkflowInstance(workflowId, updates) {
    const updateData = {};
    if (updates.currentStep) updateData.current_step = updates.currentStep;
    if (updates.status) updateData.status = updates.status;
    if (updates.variables) updateData.variables = updates.variables;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;

    const res = await WorkflowModel.updateOne({ id: workflowId }, updateData);
    return res.modifiedCount > 0;
  }

  async getWorkflowInstance(workflowId) {
    return await WorkflowModel.findOne({ id: workflowId }).lean();
  }

  async getAllWorkflowInstances() {
    return await WorkflowModel.find().sort({ created_at: -1 }).lean();
  }

  async close() {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

module.exports = Database;

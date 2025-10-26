// Simple wrapper that delegates everything to Flowable
const FlowableWorkflowEngine = require("./flowableWorkflowEngine");

class WorkflowEngine {
  constructor(database) {
    console.log("Using Flowable BPMN Engine");
    this.flowableEngine = new FlowableWorkflowEngine(database);
  }

  async startWorkflow(documentId, filePath, originalFilename) {
    return await this.flowableEngine.startWorkflow(
      documentId,
      filePath,
      originalFilename
    );
  }

  async completeTask(taskId, action, reason = "") {
    return await this.flowableEngine.completeManualTask(taskId, action, reason);
  }

  async getDocumentStatus(documentId) {
    return await this.flowableEngine.getDocumentStatus(documentId);
  }

  async getPendingTasks() {
    return await this.flowableEngine.getPendingTasks();
  }

  async getAllWorkflows() {
    return await this.flowableEngine.getAllWorkflows();
  }
}

module.exports = WorkflowEngine;

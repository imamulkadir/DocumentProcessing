const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const DocumentProcessor = require("./services/documentProcessor");
const WorkflowEngine = require("./services/workflowEngine");
const Database = require("./models/dbMongo");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Upload configuration
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const documentId = `DOC-${uuidv4().substring(0, 8).toUpperCase()}`;
    const extension = path.extname(file.originalname);
    req.documentId = documentId;
    cb(null, `${documentId}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".pdf", ".docx"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only PDF and DOCX files are allowed"),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB
  },
});

// Initialize services
const db = new Database();
const documentProcessor = new DocumentProcessor();
const workflowEngine = new WorkflowEngine(db);

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    message: "Document Processing Workflow API",
    timestamp: new Date().toISOString(),
  });
});

app.get("/getToken", (req, res) => {
  // const token = uuidv4();
  const token = jwt.sign({ user: "admin" }, "#51sa%!^ui*", {
    expiresIn: "2h",
  });
  res.json({ token: token });
});

const verifyToken = (req, res, next) => {
  const token = req.query.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      error:
        "Unauthorized: No token provided\nGo To Authorization\nSelect 'Bearer' from Auth Type\nThen Select File & Send",
    });
  }
  jwt.verify(token, "#51sa%!^ui*", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

app.post(
  "/documents/upload",
  upload.single("file"),
  verifyToken,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // const token = req.query.token || req.headers.authorization?.split(" ")[1];

      // verifyToken(token);

      // if (!token || !req.file) {
      //   return res.status(400).json({
      //     error: !token ? "Missing token! Authorization>" : "No file uploaded",
      //   });
      // }

      const documentId = req.documentId;
      const filePath = req.file.path;
      const originalName = req.file.originalname;
      console.log("Upload request for documentId:", documentId);
      console.log("File path:", filePath);
      console.log("Original file name:", originalName);
      // Start workflow
      const result = await workflowEngine.startWorkflow(
        documentId,
        filePath,
        originalName
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: `Upload failed: ${error.message}` });
    }
  }
);

app.get("/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const result = await workflowEngine.getDocumentStatus(documentId);

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("Get document error:", error);
    res
      .status(500)
      .json({ error: `Failed to retrieve document: ${error.message}` });
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const tasks = await workflowEngine.getPendingTasks();
    res.json({
      tasks: tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res
      .status(500)
      .json({ error: `Failed to retrieve tasks: ${error.message}` });
  }
});

app.post("/tasks/:taskId/complete", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, reason } = req.body;

    if (!action) {
      return res
        .status(400)
        .json({ error: "Missing action field (approve/reject)" });
    }

    if (!["approve", "reject"].includes(action.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Action must be either "approve" or "reject"' });
    }

    const result = await workflowEngine.completeTask(
      taskId,
      action.toLowerCase(),
      reason || ""
    );

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "Task not found or already completed" });
    }
  } catch (error) {
    console.error("Complete task error:", error);
    res
      .status(500)
      .json({ error: `Failed to complete task: ${error.message}` });
  }
});

// Get all workflow instances
app.get("/workflows", async (req, res) => {
  try {
    const workflows = await workflowEngine.getAllWorkflows();
    res.json({
      workflows: workflows,
      count: workflows.length,
    });
  } catch (error) {
    console.error("Get workflows error:", error);
    res
      .status(500)
      .json({ error: `Failed to retrieve workflows: ${error.message}` });
  }
});

// Get BPMN process definition
app.get("/bpmn/definition", (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const bpmnPath = path.join(
      __dirname,
      "..",
      "bpmn",
      "document_processing.bpmn"
    );
    const bpmnContent = fs.readFileSync(bpmnPath, "utf8");

    res.set("Content-Type", "application/xml");
    res.send(bpmnContent);
  } catch (error) {
    console.error("Get BPMN definition error:", error);
    res
      .status(500)
      .json({ error: `Failed to retrieve BPMN definition: ${error.message}` });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 16MB" });
    }
  }

  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Document Workflow API server running on port ${PORT}`);
});

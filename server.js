require("dotenv").config();
const path = require("path");
const os = require("os");
const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const projectRoot = __dirname;
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const dataRoot =
  process.env.DATA_DIR ||
  (isVercel ? path.join(os.tmpdir(), "health-wealth") : path.join(projectRoot, "data"));

async function connectDB() {
  const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn("⚠️  MONGODB_URI/DATABASE_URL not configured. Using JSON files for now.");
    return;
  }
  
  try {
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      return;
    }
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.log("⚙️  Falling back to JSON file storage...");
  }
}

const userSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  symptomHistory: [
    {
      symptom: String,
      date: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const clinicSchema = new mongoose.Schema({
  id: String,
  name: String,
  specialty: String,
  address: String,
  lat: Number,
  lng: Number,
  status: String,
  phone: String,
  rating: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Clinic = mongoose.model("Clinic", clinicSchema);

let transporter;

if (process.env.SENDGRID_API_KEY) {
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  transporter = {
    sendMail: async (mailOptions) => {
      try {
        await sgMail.send({
          to: mailOptions.to,
          from: process.env.EMAIL_FROM_ADDRESS,
          subject: mailOptions.subject,
          html: mailOptions.html
        });
        return { success: true };
      } catch (error) {
        console.error("SendGrid Error:", error);
        throw error;
      }
    }
  };
} else if (process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  // Mock transporter for testing
  transporter = {
    sendMail: async (mailOptions) => {
      console.log("📧 Mock Email (configure SMTP in .env):", {
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      return { messageId: "mock-" + crypto.randomBytes(4).toString("hex") };
    }
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(
  express.static(projectRoot, {
    extensions: ["html"],
  })
);

app.use("/src", express.static(path.join(projectRoot, "src")));
app.use("/assets", express.static(path.join(projectRoot, "assets")));

const usersDbPath = path.join(dataRoot, "users.json");
const clinicsDbPath = path.join(dataRoot, "clinics.json");

if (!fs.existsSync(dataRoot)) {
  fs.mkdirSync(dataRoot, { recursive: true });
}

function initializeDb() {
  if (!fs.existsSync(usersDbPath)) {
    fs.writeFileSync(usersDbPath, JSON.stringify({ users: [] }, null, 2));
  }
  if (!fs.existsSync(clinicsDbPath)) {
    const realClinics = {
      clinics: [
        {
          id: 1,
          name: "All India Institute of Medical Sciences (AIIMS)",
          specialty: "Multi-specialty Hospital",
          address: "Ansari Nagar, New Delhi",
          lat: 28.5704,
          lng: 77.2039,
          status: "open",
          rating: 4.7,
          affordability: "Affordable",
          phone: "+91-11-2658-8500",
          email: "contact@aiims.edu",
          type: "Government Hospital"
        },
        {
          id: 2,
          name: "Apollo Hospitals Delhi",
          specialty: "Multi-specialty Hospital",
          address: "Sarita Vihar, New Delhi",
          lat: 28.5234,
          lng: 77.2569,
          status: "open",
          rating: 4.6,
          affordability: "Moderate",
          phone: "+91-11-2159-1234",
          email: "contact@apollodelhi.com",
          type: "Private Hospital"
        },
        {
          id: 3,
          name: "Max Healthcare - Saket",
          specialty: "Multi-specialty Hospital",
          address: "Saket, New Delhi",
          lat: 28.5244,
          lng: 77.1955,
          status: "open",
          rating: 4.5,
          affordability: "Moderate",
          phone: "+91-11-4141-1111",
          email: "contact@maxhealthcare.com",
          type: "Private Hospital"
        },
        {
          id: 4,
          name: "Fortis Hospital La Femme",
          specialty: "Women's Health & Fertility",
          address: "Greater Kailash, New Delhi",
          lat: 28.5224,
          lng: 77.2024,
          status: "open",
          rating: 4.8,
          affordability: "Moderate",
          phone: "+91-11-4155-5555",
          email: "lafemme@fortishealthcare.com",
          type: "Specialty Hospital"
        },
        {
          id: 5,
          name: "Delhi Heart Institute",
          specialty: "Cardiology & Heart Surgery",
          address: "Burari, New Delhi",
          lat: 28.7589,
          lng: 77.0733,
          status: "open",
          rating: 4.7,
          affordability: "Affordable",
          phone: "+91-11-4747-4747",
          email: "info@delhiheartinst.com",
          type: "Specialty Hospital"
        },
        {
          id: 6,
          name: "Medeor Hospital",
          specialty: "General & Emergency Care",
          address: "Karol Bagh, New Delhi",
          lat: 28.6462,
          lng: 77.1943,
          status: "open",
          rating: 4.4,
          affordability: "Affordable",
          phone: "+91-11-4567-8900",
          email: "contact@medeor.com",
          type: "Multi-specialty Clinic"
        }
      ]
    };
    fs.writeFileSync(clinicsDbPath, JSON.stringify(realClinics, null, 2));
  }
}

initializeDb();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersDbPath, "utf-8")).users || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersDbPath, JSON.stringify({ users }, null, 2));
}

function readClinics() {
  try {
    return JSON.parse(fs.readFileSync(clinicsDbPath, "utf-8")).clinics || [];
  } catch {
    return [];
  }
}

function generateToken(userId) {
  return Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString("base64");
}

function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    return decoded;
  } catch {
    return null;
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

async function sendEmail(to, subject, htmlBody) {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Health Wealth'}" <${process.env.EMAIL_FROM_ADDRESS || 'noreply@healthwealth.com'}>`,
      to: to,
      subject: subject,
      html: htmlBody
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error.message);
    throw error;
  }
}

function getWelcomeEmailTemplate(userName) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; padding: 30px; }
          .header { color: #333; font-size: 24px; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="header">Welcome to Health Wealth! 🏥</h1>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Thank you for signing up! We're excited to help you manage your health and find affordable medical care.</p>
            
            <h3 style="color: #667eea;">What you can do:</h3>
            <ul>
              <li>Track wellness with our micro-break timer</li>
              <li>Map your symptoms to nearby specialists</li>
              <li>Find affordable clinics in your area</li>
              <li>Manage your health records securely</li>
            </ul>
            
            <p><strong>Get Started:</strong></p>
            <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">Open Health Wealth</a>
            
            <p style="margin-top: 20px;">Questions? We're here to help!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Health Wealth. All rights reserved.</p>
            <p>Quantum Overrides Team</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getClinicContactTemplate(userName, userEmail, clinicName, symptom) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 20px auto; background: #f5f5f5; border-radius: 10px; padding: 30px; }
          .header { color: #333; font-size: 20px; margin-bottom: 20px; background: white; padding: 20px; border-radius: 5px; }
          .info { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
          .info-label { color: #667eea; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">New Appointment Inquiry - ${clinicName}</div>
          
          <div class="info">
            <p><span class="info-label">Patient Name:</span> ${userName}</p>
            <p><span class="info-label">Contact Email:</span> <a href="mailto:${userEmail}">${userEmail}</a></p>
            <p><span class="info-label">Clinic:</span> ${clinicName}</p>
            <p><span class="info-label">Symptom/Concern:</span> ${symptom}</p>
          </div>
          
          <div class="info">
            <p>The patient came through the Health Wealth app and is interested in your services.</p>
            <p>Please reach out to confirm availability and next steps.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Serve the main page
app.get("/", (_req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

// Explicit routes for multipage navigation
app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/wellness.html", (_req, res) => {
  res.sendFile(path.join(projectRoot, "wellness.html"));
});

app.get("/mapper.html", (_req, res) => {
  res.sendFile(path.join(projectRoot, "mapper.html"));
});

app.get("/contact.html", (_req, res) => {
  res.sendFile(path.join(projectRoot, "contact.html"));
});

app.get("/health", (_req, res) => {
  res.status(200).type("text").send("ok");
});


app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const newUser = {
    id: crypto.randomBytes(8).toString("hex"),
    name,
    email,
    password: hashPassword(password),
    phone: phone || "",
    createdAt: new Date().toISOString(),
    emailVerified: false,
    symptomHistory: [],
    savedClinics: []
  };

  users.push(newUser);
  saveUsers(users);

  try {
    await sendEmail(
      email,
      "Welcome to Health Wealth! 🏥",
      getWelcomeEmailTemplate(name)
    );
    console.log("✅ Welcome email sent to", email);
  } catch (error) {
    console.error("⚠️  Failed to send welcome email:", error.message);
  }

  const token = generateToken(newUser.id);
  res.status(201).json({ 
    success: true, 
    token, 
    user: { id: newUser.id, name, email },
    message: "Account created successfully. Check your email!"
  });
});

// Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === hashPassword(password));

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = generateToken(user.id);
  res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// Get user profile
app.get("/api/auth/profile", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  const users = readUsers();
  const user = users.find(u => u.id === decoded.userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

// Get clinics
app.get("/api/clinics", (req, res) => {
  const clinics = readClinics();
  res.json({ clinics });
});

// Search clinics by specialty
app.get("/api/clinics/search", (req, res) => {
  const { specialty, lat, lng } = req.query;

  if (!specialty) {
    return res.status(400).json({ error: "Specialty required" });
  }

  let clinics = readClinics().filter(c =>
    c.specialty.toLowerCase().includes(specialty.toLowerCase())
  );

  // Sort by distance if location provided
  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    clinics = clinics
      .map(clinic => ({
        ...clinic,
        distance: calculateDistance(userLat, userLng, clinic.lat, clinic.lng)
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  res.json({ clinics });
});

// Get clinics near user location
app.get("/api/clinics/near", (req, res) => {
  const { lat, lng, radius = 50 } = req.query;
  
  if (!lat || !lng) {
    return res.status(400).json({ error: "Latitude and longitude required" });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const searchRadius = parseFloat(radius);

  const clinics = readClinics()
    .map(clinic => ({
      ...clinic,
      distance: calculateDistance(userLat, userLng, clinic.lat, clinic.lng)
    }))
    .filter(clinic => clinic.distance <= searchRadius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  res.json({ clinics, userLocation: { lat: userLat, lng: userLng } });
});

// Send clinic inquiry email
app.post("/api/email/clinic-inquiry", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { clinicId, symptom } = req.body;

  if (!token) return res.status(401).json({ error: "Authentication required" });
  if (!clinicId || !symptom) return res.status(400).json({ error: "Missing required fields" });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  const users = readUsers();
  const user = users.find(u => u.id === decoded.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const clinics = readClinics();
  const clinic = clinics.find(c => c.id === parseInt(clinicId));
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  try {
    // Send email to clinic
    await sendEmail(
      clinic.email,
      `New Appointment Inquiry - ${user.name}`,
      getClinicContactTemplate(user.name, user.email, clinic.name, symptom)
    );

    // Send confirmation to user
    await sendEmail(
      user.email,
      `Appointment Request Sent to ${clinic.name}`,
      `<h2>Request Confirmation</h2><p>Hi ${user.name},</p><p>Your appointment inquiry has been sent to <strong>${clinic.name}</strong>.</p><p>They will contact you shortly at <strong>${user.email}</strong>.</p><p>Thank you for using Health Wealth!</p>`
    );

    res.json({ success: true, message: "Inquiry sent to clinic and confirmation email sent to you" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send email: " + error.message });
  }
});

// Send contact form email
app.post("/api/email/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Send to support
    await sendEmail(
      process.env.EMAIL_FROM_ADDRESS || "noreply@healthwealth.com",
      `New Contact: ${subject} from ${name}`,
      `<p><strong>From:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Subject:</strong> ${subject}</p><hr/><p>${message}</p>`
    );

    // Send confirmation to user
    await sendEmail(
      email,
      "We received your message - Health Wealth",
      `<h2>Thank You!</h2><p>Hi ${name},</p><p>We received your message and will get back to you soon.</p><p>Best regards,<br/>Health Wealth Team</p>`
    );

    res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send email: " + error.message });
  }
});

// Save symptom inquiry
app.post("/api/symptoms/save", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { symptom, specialist, clinic } = req.body;

  if (!token) return res.status(401).json({ error: "No token provided" });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === decoded.userId);
  
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  const inquiry = {
    id: crypto.randomBytes(4).toString("hex"),
    symptom,
    specialist,
    clinic,
    timestamp: new Date().toISOString()
  };

  users[userIndex].symptomHistory.push(inquiry);
  saveUsers(users);

  res.json({ success: true, inquiry });
});

if (!isVercel) {
  app.listen(PORT, async () => {
    await connectDB();
    
    console.log(`
    ╔════════════════════════════════════════════════════════╗
    ║  🏥 Health Wealth Server Running!                      ║
    ╠════════════════════════════════════════════════════════╣
    ║  📍 URL: http://localhost:${PORT}                            ║
    ║  🌍 Environment: ${process.env.NODE_ENV || "development"}                    ║
    ║  📧 Email Service: ${process.env.SENDGRID_API_KEY ? "✅ SendGrid" : process.env.SMTP_USER ? "✅ SMTP (Gmail/Custom)" : "⚠️  Mock (Dev Only)"}   ║
    ║  💾 Database: ${process.env.DATABASE_URL ? "✅ MongoDB" : "JSON Files (./data/)"}                     ║
    ║  🏥 Real Clinics: 6 hospitals (Delhi region)          ║
    ╚════════════════════════════════════════════════════════╝
    
    📚 API Endpoints:
    • POST   /api/auth/register          - Create account (sends email)
    • POST   /api/auth/login             - Sign in
    • GET    /api/auth/profile           - Get user info
    • GET    /api/clinics                - List all clinics
    • GET    /api/clinics/near           - Find nearby clinics
    • GET    /api/clinics/search         - Search by specialty
    • POST   /api/email/clinic-inquiry   - Send appointment request
    • POST   /api/email/contact          - Send contact form
    • POST   /api/symptoms/save          - Save symptom history
    
    ⚙️  Configuration:
    ${!process.env.SMTP_USER && !process.env.SENDGRID_API_KEY ? `⚠️  EMAIL NOT CONFIGURED - Update .env file` : `✅ Email configured with ${process.env.SENDGRID_API_KEY ? "SendGrid" : "SMTP"}`}
    ✅ CORS enabled
    ✅ Real clinic data loaded
    
    `);
  });
} else {
  void connectDB();
}

module.exports = app;


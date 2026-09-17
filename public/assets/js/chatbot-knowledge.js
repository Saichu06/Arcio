// =============================================================================
// ARCIO — Chatbot Knowledge Base & Rule Engine
// Interactive user manual & navigation assistant based on ARCIO repository features.
// =============================================================================

export const CHATBOT_SUGGESTED_PROMPTS = [
  "How do I start an experiment?",
  "What is Smart Inspector?",
  "How do I get my certificate?",
  "How do I use the Playground?",
  "What are Advanced Modules?",
  "How do I report an issue?"
];

export const CHATBOT_FALLBACK_RESPONSE =
  "I'm not sure about that yet. Try asking about experiments, dashboard, Playground, certificates, advanced modules, profile, or navigation.";

export const CHATBOT_KNOWLEDGE = [
  {
    id: "about_arcio",
    title: "What is ARCIO?",
    keywords: ["what is arcio", "about arcio", "arcio overview", "introduction", "virtual lab", "about"],
    answer: "ARCIO is an Advanced Research & Circuit IoT Operations virtual laboratory designed for SRM students and faculty. It allows you to design, simulate, and analyze ESP32 and Arduino IoT experiments right in your web browser with zero hardware required."
  },
  {
    id: "start_experiment",
    title: "How do I start an experiment?",
    keywords: ["start experiment", "begin experiment", "open experiment", "launch experiment", "run lab", "how do i start", "how to start"],
    answer: "To start an experiment:\n1. Open your **Dashboard** (`/dashboard`).\n2. Scroll down to the **Core Experiments** section (Labs 01 to 10).\n3. Click on any experiment card or click **Start Experiment** to open the interactive simulation canvas with circuit wiring and Arduino code."
  },
  {
    id: "complete_experiment",
    title: "How do I complete an experiment?",
    keywords: ["complete experiment", "finish experiment", "mark complete", "how do i complete", "how to complete", "finish lab"],
    answer: "To complete an experiment:\n1. Follow the step-by-step procedure guide on the experiment page.\n2. Verify the wiring and run the simulation using the code editor controls.\n3. Check the expected output against live simulator behavior.\n4. Click **Mark Completed** at the bottom of the lab to record your progress, earn XP points, and update your dashboard statistics."
  },
  {
    id: "experiments_list",
    title: "Where can I find the experiments?",
    keywords: ["find experiments", "list of experiments", "where are experiments", "experiments", "labs", "core experiments", "exp 1", "exp 2", "exp 3", "exp 4", "exp 5", "exp 6", "exp 7", "exp 8", "exp 9", "exp 10"],
    answer: "ARCIO includes 10 core IoT experiments:\n• **Exp 01:** LED Blink (Basic I/O)\n• **Exp 02:** Button Input & Debouncing\n• **Exp 03:** PWM LED Dimming\n• **Exp 04:** Automatic Light Detection (LDR)\n• **Exp 05:** Temperature Monitoring (DHT22)\n• **Exp 06:** Buzzer Frequency & Tone Control\n• **Exp 07:** Servo Motor Angle Control\n• **Exp 08:** Ultrasonic Distance Measurement (HC-SR04)\n• **Exp 09:** Relay Module Appliance Control\n• **Exp 10:** Integrated Smart Home Scene\n\nAll experiments are accessible directly from your **Dashboard**."
  },
  {
    id: "smart_inspector",
    title: "What is Smart Inspector?",
    keywords: ["smart inspector", "inspector", "pin mapping", "component inspector", "inspect"],
    answer: "The **Smart Inspector** is an interactive analysis overlay built into ARCIO's simulator. When you hover over or select any electronic component (ESP32, LED, Resistor, DHT22, Servo, Ultrasonic Sensor, Relay) on the circuit board, the Smart Inspector reveals its live pin mapping, operating voltage, electrical limits, and wiring state in real-time."
  },
  {
    id: "arduino_simulator",
    title: "How do I use the Arduino simulator?",
    keywords: ["arduino simulator", "simulator", "code editor", "how do i use the simulator", "upload code", "serial monitor"],
    answer: "The ARCIO simulator provides:\n• **Circuit Canvas:** Visual breadboard, microcontrollers (ESP32/UNO), sensors, and actuators with live pin animations.\n• **Arduino C++ Editor:** Pre-loaded with working code with syntax highlighting.\n• **Control Bar:** Buttons to Run/Stop simulation, reset state, and step through operations.\n• **Live Serial Monitor:** Displays real-time serial output and sensor telemetry."
  },
  {
    id: "fullscreen_visualizer",
    title: "How do I open the fullscreen Arduino visualizer?",
    keywords: ["fullscreen", "visualizer", "full screen", "maximize simulator", "fullscreen visualizer"],
    answer: "On any experiment page, locate the **Fullscreen Visualizer** button in the simulator header toolbar. Clicking it expands the circuit canvas, pin diagrams, and animated components to full screen for an immersive, distraction-free laboratory workspace. Press `Esc` or click the exit button to return."
  },
  {
    id: "playground",
    title: "How do I use the Playground?",
    keywords: ["playground", "interactive playground", "playground modules", "smart systems", "door", "fire", "irrigation", "parking", "streetlight", "security"],
    answer: "The **ARCIO Playground** (`/playground/playground.html`) offers 6 ready-to-test smart IoT systems:\n1. **Smart Door Access** (RFID & Servo locks)\n2. **Fire Safety System** (Flame & Gas detection)\n3. **Smart Irrigation** (Moisture & Water Pump)\n4. **Smart Parking** (Slot occupancy & gates)\n5. **Automated Streetlight** (LDR auto-dimming)\n6. **Security Alarm System** (PIR motion alert)\n\nYou can access it anytime via the **Playground** link in the dashboard navigation."
  },
  {
    id: "advanced_modules",
    title: "How do I access advanced modules?",
    keywords: ["advanced modules", "advance", "ai modules", "digital twin", "agriculture ai", "env advisor", "smarthome twin"],
    answer: "ARCIO includes 3 Advanced Modules combining IoT, AI, and Digital Twins:\n1. **Agriculture AI** (`/advance/agricultureai`): AI-driven soil & crop intelligence.\n2. **Environmental Advisor** (`/advance/env_advisor`): Real-time weather, AQI, and eco-analytics.\n3. **Smart Home Twin** (`/advance/smarthome_twin`): Full interactive 3D digital twin.\n\nAccess them from the **Advanced Modules** section on your Dashboard."
  },
  {
    id: "certificate",
    title: "How do I get my certificate?",
    keywords: ["certificate", "get certificate", "certificate generation", "when is my certificate generated", "download certificate", "print certificate", "certification"],
    answer: "Here is how ARCIO certificate issuance works:\n1. Complete all required core experiments on your dashboard.\n2. Once eligible, the **Certificate** card on your dashboard will become active.\n3. Click **Generate Certificate** and enter your full student name.\n4. ⚠️ **Note:** Your name will be permanently locked onto the certificate with your SRM registration number.\n5. You can then view, print, or download your official verified ARCIO certificate as a PDF."
  },
  {
    id: "dashboard_navigation",
    title: "How do I navigate the dashboard?",
    keywords: ["navigate dashboard", "dashboard", "where can i see completed", "completed experiments", "progress", "xp score"],
    answer: "Your ARCIO **Dashboard** (`/dashboard`) is your central hub:\n• **Top Header:** Quick statistics (completion %, total XP, active labs) and your student profile.\n• **Progress Overview:** Visual progress tracker showing completed vs remaining experiments.\n• **Core Labs Section:** Direct launch cards for all 10 experiments.\n• **Quick Links:** Fast access to Playground, Advanced Modules, and Certificate generator."
  },
  {
    id: "auth_account",
    title: "How do I log in or create an account?",
    keywords: ["login", "sign in", "create account", "register", "how do i log in", "srm email", "registration number", "forgot password", "password"],
    answer: "To access ARCIO:\n• **Sign In:** Use your registered SRM email (`@srmist.edu.in`) OR your Registration Number with your password.\n• **Register:** Click 'Create Account' on the login modal, enter your full name, SRM Registration Number, `@srmist.edu.in` email, and password.\n• **Forgot Password:** Click 'Forgot password?' on the sign-in modal to receive a secure password reset link."
  },
  {
    id: "profile",
    title: "How do I view or update my profile?",
    keywords: ["profile", "account", "view profile", "my profile", "my account", "sign out", "logout"],
    answer: "Click your student name or avatar in the top-right corner of the Dashboard. A profile modal will open showing your Full Name, SRM Registration Number, Email, Account Type (Student), and Certificate Status. You can also sign out from this modal."
  },
  {
    id: "troubleshooting",
    title: "What should I do if an experiment is not working?",
    keywords: ["not working", "troubleshooting", "experiment not working", "bug", "stuck", "error", "simulation issue"],
    answer: "If you encounter any simulator or experiment issues:\n1. Refresh the page to reload the virtual circuit.\n2. Click the **Reset** button in the simulator toolbar.\n3. Check your browser console for script blocks, or disable conflicting ad-block extensions.\n4. If the issue persists, report it using the **Share Feedback** form!"
  },
  {
    id: "feedback_grievance",
    title: "How do I provide feedback or report an issue?",
    keywords: ["feedback", "report issue", "grievance", "concerns", "suggestion", "share feedback", "contact", "report a bug"],
    answer: "We welcome your feedback and grievance reports! Look for the **'Any concerns? Let us know.'** section on the Home Page or Dashboard, and click **Share Feedback** to open our official feedback form in a new tab."
  }
];

/**
 * Searches the knowledge base using keyword matching and normalized intent scoring.
 */
export function queryChatbot(userInput) {
  if (!userInput || !userInput.trim()) {
    return CHATBOT_FALLBACK_RESPONSE;
  }

  const query = userInput.toLowerCase().trim();
  const tokens = query.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  let bestMatch = null;
  let highestScore = 0;

  for (const entry of CHATBOT_KNOWLEDGE) {
    let score = 0;

    // Direct title match
    if (query.includes(entry.title.toLowerCase()) || entry.title.toLowerCase().includes(query)) {
      score += 15;
    }

    // Keyword exact and partial matches
    for (const kw of entry.keywords) {
      const lowerKw = kw.toLowerCase();
      if (query === lowerKw) {
        score += 25;
      } else if (query.includes(lowerKw)) {
        score += 12 + lowerKw.length;
      } else {
        // Check token intersection
        const kwTokens = lowerKw.split(/\s+/);
        let matchCount = 0;
        for (const t of tokens) {
          if (kwTokens.includes(t)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          score += matchCount * 4;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = entry;
    }
  }

  // Threshold check to prevent irrelevant matching
  if (bestMatch && highestScore >= 6) {
    return bestMatch.answer;
  }

  return CHATBOT_FALLBACK_RESPONSE;
}

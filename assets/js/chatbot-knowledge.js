// =============================================================================
// ARCIO — Chatbot Knowledge Base & Rule Engine  (v2)
// -----------------------------------------------------------------------------
// A fully offline, rule-based help assistant for ARCIO.
//
//  • Answers ONLY from what is actually in ARCIO (labs, workspace, dashboard,
//    playground, advanced modules, XP/badges, certificate, account).
//  • Anything else -> an honest "I don't know".
//  • Understands typos, shorthand ("exp 5", "cert", "hw to login"), lab numbers
//    ("lab 4 wiring"), follow-ups ("and its components?") and small talk.
//
// HOW TO ADD KNOWLEDGE
//   1. Add an object to CHATBOT_KNOWLEDGE (id, title, keywords, answer, next).
//   2. Lab facts live in LABS below — the lab answers are generated from it.
//   3. Run:  node tests/chatbot.test.mjs   (checks every chip / follow-up resolves)
// =============================================================================

// -----------------------------------------------------------------------------
// 0. PUBLIC CONSTANTS
// -----------------------------------------------------------------------------
export const CHATBOT_SUGGESTED_PROMPTS = [
  "How do I start a lab?",
  "How do I build a circuit?",
  "How do I get my certificate?",
  "How do XP and levels work?",
  "What is the Playground?",
  "How do I report an issue?"
];

const FALLBACK_OUT_OF_SCOPE =
  "Sorry, I don't know about that — it's outside what I can help with. I only cover **ARCIO**: the labs, the lab workspace, Playground, Advanced modules, XP & certificates, and your account.";

const FALLBACK_IN_SCOPE =
  "Sorry, I don't know the answer to that one — I don't have it in my ARCIO help topics yet. Try rephrasing, or send it through **Share Feedback** so the team can add it.";

// kept for backwards compatibility with older imports
export const CHATBOT_FALLBACK_RESPONSE = FALLBACK_OUT_OF_SCOPE;

const FALLBACK_CHIPS = ["What can you help me with?", "How do I start a lab?", "How do I report an issue?"];

// -----------------------------------------------------------------------------
// 1. TEXT NORMALISATION  (typos, shorthand, synonyms)
// -----------------------------------------------------------------------------
const STOPWORDS = new Set((
  "a an the is are was were be been am do does did i me my mine you your yours we our us it its " +
  "to of in on at for with and or but if so that this these those there here can could should would will " +
  "shall may might must please tell show give want how what which who whom when where why just also any " +
  "some get gets got let lets like know thing things ok okay hi hello hey help there s t d ll re ve m " +
  "into from by as than then them they he she his her him am been being have has had having more much very " +
  "really actually basically kindly bro sir mam arcio"
).split(/\s+/));

const PHRASE_MAP = [
  [/[\u2019\u2018`']/g, ""],
  [/\bhc[\s-]?sr[\s-]?0?4\b/g, "hcsr04"],
  [/\besp[\s-]?32\b/g, "esp32"],
  [/\bdht[\s-]?(11|22)\b/g, "dht"],
  [/\bi\s*\/\s*o\b/g, "io"],
  [/\bwi[\s-]?fi\b/g, "wifi"],
  [/\blog[\s-]?in\b/g, "login"],
  [/\bsign[\s-]?in\b/g, "login"],
  [/\blog[\s-]?out\b/g, "logout"],
  [/\bsign[\s-]?out\b/g, "logout"],
  [/\bsign[\s-]?up\b/g, "register"],
  [/\bcreate (an |my |a )?(new )?account\b/g, "register"],
  [/\b(reg|register|registration|roll)[\s.]*(no|num|number|#)\b/g, "regno"],
  [/\bpass[\s-]?word\b/g, "password"],
  [/\bpush[\s-]?buttons?\b/g, "button"],
  [/\bstreet[\s-]?lights?\b/g, "streetlight"],
  [/\bstreet lamps?\b/g, "streetlight"],
  [/\bsmart[\s-]?home\b/g, "smarthome"],
  [/\bdigital twin\b/g, "digitaltwin"],
  [/\bfull[\s-]?screen\b/g, "fullscreen"],
  [/\bdark[\s-]?mode\b/g, "darkmode"],
  [/\blight[\s-]?mode\b/g, "lightmode"],
  [/\b(does ?n?o?t|doesnt|dont|do not|wont|will not|isnt|is not|arent|are not|cant|cannot|can not|didnt|did not|couldnt|unable to)\s+(work|working|load|loading|open|opening|respond|responding|run|running|start|starting|show|showing|appear|appearing|turn on|light up|glow|glowing|sound|sounding|move|moving|connect|connecting)\b/g, "problem"],
  [/\b(not|no)\s+(work|working|loading|responding|opening|showing|glowing|lighting|sounding|moving)\b/g, "problem"],
  [/\bnothing happens\b/g, "problem"]
];

const TOKEN_MAP = {
  nt: "not", wht: "what", whts: "what", hw: "how", abt: "about", pls: "please", plz: "please",
  u: "you", ur: "your", r: "are", thx: "thanks", tnx: "thanks", tq: "thanks", ty: "thanks", thanku: "thanks",
  // "experiment" and "lab" are the same thing in ARCIO
  exp: "lab", exps: "lab", expt: "lab", expts: "lab", experiment: "lab", experiments: "lab",
  experiement: "lab", expirement: "lab", experimnt: "lab", labs: "lab", practical: "lab", practicals: "lab",
  cert: "certificate", certi: "certificate", certs: "certificate", certificates: "certificate",
  certification: "certificate", certifcate: "certificate", certficate: "certificate", certifiate: "certificate",
  sim: "simulator", sims: "simulator", simulation: "simulator", simulations: "simulator",
  simulate: "simulator", simulated: "simulator", simulating: "simulator", simulators: "simulator",
  wiring: "wire", wires: "wire", wired: "wire", connect: "wire", connection: "wire", connections: "wire",
  connecting: "wire", connected: "wire", hookup: "wire",
  parts: "component", part: "component", components: "component", hardware: "component",
  materials: "component", apparatus: "component",
  pins: "pin", ports: "port",
  begin: "start", starting: "start", started: "start", launch: "start", open: "start", opening: "start",
  fnish: "complete", finsh: "complete", finish: "complete", finished: "complete", completed: "complete", completion: "complete",
  completing: "complete", done: "complete",
  points: "xp", point: "xp", score: "xp", reward: "xp", rewards: "xp",
  levels: "level", rank: "level", ranks: "level",
  badges: "badge", achievements: "badge", achievement: "badge", trophies: "badge",
  bug: "problem", bugs: "problem", error: "problem", errors: "problem", issue: "problem", issues: "problem",
  trouble: "problem", fail: "problem", fails: "problem", failed: "problem", broken: "problem",
  glitch: "problem", crash: "problem", crashed: "problem", stuck: "problem", freeze: "problem",
  frozen: "problem", hangs: "problem", hang: "problem",
  signin: "login", logon: "login", signup: "register", registering: "register", registration: "register",
  registered: "register", enroll: "register", enrol: "register",
  pwd: "password", passwd: "password", passcode: "password", forgot: "forgot", forget: "forgot", forgotten: "forgot",
  dash: "dashboard", dashbord: "dashboard", dashboards: "dashboard", pg: "playground",
  mail: "email", emailid: "email", gmail: "email",
  esp: "esp32", arduno: "arduino", ardiuno: "arduino", arudino: "arduino",
  buzer: "buzzer", bazzer: "buzzer", buzzers: "buzzer",
  servos: "servo", relays: "relay", leds: "led",
  pot: "potentiometer", potentiometre: "potentiometer", potentio: "potentiometer", potenciometer: "potentiometer",
  photoresistor: "ldr", photoresister: "ldr", ldrs: "ldr",
  temp: "temperature", tempreature: "temperature", temprature: "temperature",
  ultrasonics: "ultrasonic", sonar: "ultrasonic",
  favourite: "favorite", favourites: "favorite", favorites: "favorite", favorited: "favorite",
  analyse: "analyze", analyser: "analyzer", analyzing: "analyze", analysis: "analyze",
  downloaded: "download", downloading: "download", printing: "print", printed: "print",
  labeled: "label", playgrounds: "playground",
  colour: "color", colours: "color",
  utility: "utility"
};

function stem(w) {
  if (w.length <= 3 || /^\d+$/.test(w)) return w;
  if (/(ss|us|is|ous)$/.test(w)) return w;
  let s = w;
  if (s.endsWith("ies") && s.length > 4) s = s.slice(0, -3) + "y";
  else if (/(ches|shes|xes|zes|sses)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith("s")) s = s.slice(0, -1);
  if (s.length >= 7 && s.endsWith("ing")) {
    s = s.slice(0, -3);
    if (/([a-z])\1$/.test(s)) s = s.slice(0, -1);
  }
  return s;
}

/** lowercase + phrase fixes + token map. Result is a plain space-separated string. */
function norm(text) {
  let s = String(text || "").toLowerCase();
  for (const [re, rep] of PHRASE_MAP) s = s.replace(re, rep);
  s = s.replace(/[^a-z0-9\s]/g, " ");
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(t => (Object.prototype.hasOwnProperty.call(TOKEN_MAP, t) ? TOKEN_MAP[t] : t))
    .join(" ");
}

/** normalised string -> informative, stemmed tokens */
function tokenize(normalised) {
  return normalised
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t))
    .map(stem);
}

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? last : 1 + Math.min(last, prev[j], prev[j - 1]);
      last = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

// -----------------------------------------------------------------------------
// 2. LAB DATA  (taken from the real dashboard cards + lab workspace pages)
// -----------------------------------------------------------------------------
//  title     = name on the dashboard card      workspace = title inside the lab page
//  drag      = parts you actually drag out of the Component Library
//  wiring    = the connections asked for in the lab's Theory tab
const LABS = {
  "01": {
    title: "LED Blinking using ESP32", workspace: "Input / Output Simulator", board: "Arduino UNO",
    cat: "GPIO", level: "Beginner", mins: 20, xp: 20,
    parts: ["ESP32", "Breadboard", "LED", "220Ω Resistor", "Jumper Wires"],
    drag: ["Arduino UNO", "Push Button", "LED"],
    aim: "Learn digital input and output: a push button (digital input) controls an LED (digital output) while you watch the GPIO signals change in real time.",
    wiring: ["Push Button output → Arduino **Pin 2**", "Arduino **Pin 13** → LED input"],
    expected: "When you press the button, Pin 2 reads HIGH, the firmware sets Pin 13 HIGH and the LED turns ON. Release the button and the LED turns OFF.",
    concepts: ["GPIO Output", "Digital Write", "HIGH / LOW", "Delay Function", "Circuit Setup"],
    interact: "Press and hold the on-screen push button with your mouse.",
    threshold: null,
    note: "The lab card says *LED Blinking*, but inside the workspace this lab is the **Input / Output Simulator** (a button controls an LED) and it uses an **Arduino UNO**."
  },
  "02": {
    title: "Push Button Input", workspace: "Digital Input Using Push Button", board: "ESP32",
    cat: "GPIO", level: "Beginner", mins: 20, xp: 20,
    parts: ["ESP32", "Breadboard", "Push Button", "LED", "220Ω Resistor", "10kΩ Resistor", "Jumper Wires"],
    drag: ["ESP32", "Push Button", "LED"],
    aim: "Read a digital input (push button) with the ESP32 and use it to switch an LED, while learning about pull-up/pull-down resistors and debouncing.",
    wiring: ["Push Button output → ESP32 **GPIO 2**", "ESP32 **GPIO 13** → LED input"],
    expected: "Press the button → GPIO 2 reads HIGH → the ESP32 sets GPIO 13 HIGH → LED ON. Release → GPIO 2 goes LOW → LED OFF.",
    concepts: ["GPIO Input", "Digital Read", "Pull-up Resistor", "Button Debounce", "Conditional Logic"],
    interact: "Press and hold the push button with your mouse.",
    threshold: null
  },
  "03": {
    title: "Potentiometer", workspace: "Analog Sensor Reading", board: "ESP32",
    cat: "GPIO", level: "Beginner", mins: 25, xp: 20,
    parts: ["ESP32", "Breadboard", "Potentiometer (10kΩ)", "LED", "220Ω Resistor", "Jumper Wires"],
    drag: ["ESP32", "Potentiometer", "LED"],
    aim: "Read a variable analog voltage from a potentiometer through the ESP32's 12-bit ADC and use it to control LED brightness with PWM.",
    wiring: ["Potentiometer output (wiper) → ESP32 pin **A0** (ADC)", "ESP32 **GPIO 2** (PWM) → LED input"],
    expected: "Turning the potentiometer from 0% to 100% gives an ADC reading of 0–4095 (shown live), which is mapped to a PWM duty of 0–255 so the LED smoothly dims or brightens.",
    concepts: ["ADC", "Analog Read", "PWM", "Duty Cycle", "Voltage Mapping"],
    interact: "Drag the potentiometer's slider.",
    threshold: null
  },
  "04": {
    title: "Automatic Light Detection", workspace: "Automatic Light Detection", board: "ESP32",
    cat: "Sensors", level: "Beginner", mins: 25, xp: 25,
    parts: ["ESP32", "Breadboard", "LDR Sensor", "LED", "220Ω Resistor", "10kΩ Resistor", "Jumper Wires"],
    drag: ["ESP32", "LDR", "LED"],
    aim: "Use an LDR (light sensor) to detect ambient light and switch an LED automatically — like an automatic street light or night lamp.",
    wiring: ["LDR output → ESP32 pin **A0** (ADC)", "ESP32 **GPIO 2** → LED input"],
    expected: "When the light level falls below the **50%** threshold the ESP32 treats it as dark and turns the LED ON; when it rises above 50% the LED turns OFF.",
    concepts: ["LDR", "Analog Sensor", "Threshold Logic", "ADC", "Light Sensing"],
    interact: "Drag the LDR's light-level slider.",
    threshold: "50% light level (below it = dark = LED ON)"
  },
  "05": {
    title: "Temperature Monitoring", workspace: "Temperature & Humidity Monitor", board: "ESP32",
    cat: "Sensors", level: "Intermediate", mins: 35, xp: 30,
    parts: ["ESP32", "Breadboard", "DHT22 Sensor", "10kΩ Resistor", "Jumper Wires"],
    drag: ["ESP32", "DHT11 / DHT22", "LED"],
    aim: "Read temperature and humidity from a DHT11/DHT22 sensor (single-wire digital protocol) and trigger a heat-alert LED when it gets too hot.",
    wiring: ["DHT11/DHT22 data → ESP32 **GPIO 4**", "ESP32 **GPIO 2** → LED input (Heat Alert)"],
    expected: "Temperature (°C) and humidity (% RH) are shown live in the Observations panel and console. When the temperature reaches **32°C or more**, GPIO 2 goes HIGH and the Heat Alert LED turns ON; below 32°C it turns OFF.",
    concepts: ["DHT22", "Temperature", "Humidity", "Serial Monitor", "Threshold Alert", "Sensor Library"],
    interact: "Drag the DHT sensor's Temperature and Humidity sliders.",
    threshold: "32°C (at or above = LED ON)"
  },
  "06": {
    title: "Buzzer Control", workspace: "Buzzer Control Using ESP32", board: "ESP32",
    cat: "Actuators", level: "Beginner", mins: 20, xp: 20,
    parts: ["ESP32", "Breadboard", "Passive Buzzer", "Jumper Wires"],
    drag: ["ESP32", "Buzzer"],
    aim: "Drive a passive buzzer with PWM and make different tones by changing the frequency, producing a simple two-tone alarm.",
    wiring: ["Buzzer signal pin → ESP32 **GPIO 12**"],
    expected: "After you press Run, the buzzer alternates between **1000 Hz and 1500 Hz**, each held for 500 ms with a short silent gap. The buzzer indicator shows ACTIVE while a tone plays and SILENT in between.",
    concepts: ["PWM", "Tone Generation", "Frequency", "Alarm Pattern", "Active vs Passive Buzzer"],
    interact: "No input needed — the tones start automatically when the simulation runs.",
    threshold: null
  },
  "07": {
    title: "Servo Motor Control", workspace: "Servo Motor Control Using ESP32", board: "ESP32",
    cat: "Actuators", level: "Intermediate", mins: 35, xp: 30,
    parts: ["ESP32", "Breadboard", "Servo Motor (SG90)", "Push Button", "Jumper Wires"],
    drag: ["ESP32", "Push Button", "Servo Motor"],
    aim: "Control a servo's shaft angle (0°–180°) with PWM, triggered by a push button, and see how pulse width maps to angle.",
    wiring: ["Push Button output → ESP32 **GPIO 2**", "ESP32 **GPIO 13** → Servo signal input"],
    expected: "While the button is held, GPIO 2 reads HIGH and the servo arm rotates smoothly to **90°**. When you release it, the servo returns to its **0°** rest position.",
    concepts: ["Servo Motor", "PWM Control", "Angle Control", "ESP32Servo Library", "Digital Input"],
    interact: "Press and hold the push button to sweep the servo arm.",
    threshold: null,
    note: "The theory tab recommends an external 5V supply for a real servo because of its current draw."
  },
  "08": {
    title: "Ultrasonic Distance Measurement", workspace: "Ultrasonic Sensor Distance Measurement", board: "ESP32",
    cat: "Sensors", level: "Intermediate", mins: 35, xp: 35,
    parts: ["ESP32", "Breadboard", "HC-SR04 Ultrasonic Sensor", "LED", "220Ω Resistor", "Jumper Wires"],
    drag: ["ESP32", "HC-SR04", "LED"],
    aim: "Measure distance with an HC-SR04 ultrasonic sensor (time-of-flight) and switch an LED on when an object gets too close — a proximity/obstacle alert.",
    wiring: ["HC-SR04 Echo output → ESP32 **GPIO 18**", "ESP32 **GPIO 5** → LED input"],
    expected: "When the simulated object is closer than **20 cm**, the ESP32 measures a short echo time, decides \"too close\" and turns the LED ON. Farther than 20 cm → LED OFF.",
    concepts: ["Ultrasonic Sensing", "Time of Flight", "pulseIn()", "Trig/Echo Timing", "Threshold Logic"],
    interact: "Drag the HC-SR04's distance slider to move the object closer or farther.",
    threshold: "20 cm (closer = LED ON)"
  },
  "09": {
    title: "Relay Module Simulation for Appliance Control", workspace: "Relay Module Simulation for Appliance Control", board: "ESP32",
    cat: "Output Devices", level: "Intermediate", mins: 25, xp: 30,
    parts: ["ESP32", "Relay Module", "Bulb", "Breadboard", "Jumper Wires"],
    drag: ["ESP32", "Relay Module", "Bulb"],
    aim: "See how a low-voltage GPIO signal can safely switch a bigger load (bulb, fan, pump) through a relay, and learn COM / NO / NC contacts.",
    wiring: ["Relay **IN** → ESP32 **GPIO 23**", "Relay **VCC** → 5V and Relay **GND** → GND", "Relay **COM** → power source", "Relay **NO** → Bulb"],
    expected: "When GPIO 23 goes HIGH the relay coil energizes, COM connects to NO and the bulb turns ON. After 2 seconds GPIO 23 goes LOW, the relay releases and the bulb turns OFF — repeating every 2 seconds.",
    concepts: ["Relay", "GPIO Output", "Switching", "Output Devices", "Electrical Isolation"],
    interact: "No input needed — the relay cycles automatically while the simulation runs.",
    threshold: null
  },
  "10": {
    title: "Smart Home Scene", workspace: "Smart Home Scene (Mini Smart Home Simulation)", board: "ESP32",
    cat: "Integration", level: "Advanced", mins: 45, xp: 50,
    parts: ["ESP32", "Breadboard", "LED", "Button", "LDR", "Buzzer", "220Ω Resistor", "10kΩ Resistor", "Jumper Wires"],
    drag: ["ESP32", "Push Button", "LDR", "LED", "Buzzer"],
    aim: "Combine a button, an LDR, an LED and a buzzer on one ESP32 to build a small smart-home scene with priority logic.",
    wiring: ["Push Button → ESP32 **GPIO 4**", "LDR → ESP32 **GPIO 34** (analog)", "ESP32 **GPIO 5** → LED", "ESP32 **GPIO 12** → Buzzer"],
    expected: "While the button is pressed, the LED turns ON and the buzzer sounds — regardless of light. When the button is released, the LDR decides: in the dark the LED turns ON silently; in bright light both stay OFF.",
    concepts: ["Integration", "State Management", "Multi-sensor Logic", "Real-world Application"],
    interact: "Hold the button to force LED + buzzer ON; release it and drag the LDR's light slider below the threshold to see the LED react to darkness.",
    threshold: "Light level below the threshold = dark (only when the button is NOT pressed)",
    note: "The lab card also lists *WiFi control* as a concept, but the workspace focuses on the button + LDR → LED + buzzer priority logic."
  }
};

const LAB_IDS = Object.keys(LABS);

const PLAY_XP = { "Smart Security": 40, "Automatic Door": 30, "Street Light Automation": 25, "Smart Irrigation": 30, "Smart Parking": 40, "Fire & Gas Safety": 40 };
const TOTAL_LAB_XP = LAB_IDS.reduce((n, k) => n + LABS[k].xp, 0);
const TOTAL_PLAY_XP = Object.values(PLAY_XP).reduce((n, v) => n + v, 0);
const TOTAL_LAB_MINS = LAB_IDS.reduce((n, k) => n + LABS[k].mins, 0);

const LEVEL_THRESHOLDS = [0, 50, 120, 220, 350, 500, 700, 950, 1250, 1600, 2000];
const LEVEL_NAMES = ["Newcomer", "Tinkerer", "Builder", "Maker", "Explorer", "Engineer", "Specialist", "Expert", "Master", "Architect", "Legend"];

function levelForXp(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) if (xp >= LEVEL_THRESHOLDS[i]) return i;
  return 0;
}

// -----------------------------------------------------------------------------
// 3. STATIC KNOWLEDGE BASE
//    title    : shown on "Did you mean?" chips (must always resolve to this entry)
//    keywords : phrases users might type (typos/synonyms are handled by norm())
//    answer   : supports **bold**, `code` and • bullets
//    next     : suggested follow-up questions (shown as chips)
// -----------------------------------------------------------------------------
export const CHATBOT_KNOWLEDGE = [
  // ───────────────────────── ABOUT ARCIO ─────────────────────────
  {
    id: "about_arcio",
    title: "What is ARCIO?",
    keywords: ["what is arcio", "arcio", "about arcio", "arcio full form", "arcio stands for", "arcio meaning", "virtual iot lab", "virtual lab", "introduction", "overview of arcio", "purpose of arcio", "why arcio", "advanced research circuit iot operations"],
    answer: "**ARCIO** (Advanced Research & Circuit IoT Operations) is a browser-based **Virtual IoT Laboratory** from SRM Institute of Science and Technology. You can design circuits, wire components, run simulations and analyze results for Arduino / ESP32 experiments — **no hardware needed**.\nIt has **10 core labs**, **6 Playground simulations** and **3 Advanced modules**.",
    next: ["What can I do on ARCIO?", "Who built ARCIO?", "How do I get started?"]
  },
  {
    id: "arcio_features",
    title: "What can I do on ARCIO?",
    keywords: ["what can i do on arcio", "features", "what does arcio offer", "what is included", "capabilities of arcio", "arcio features", "what is in arcio", "what arcio has"],
    answer: "On ARCIO you can:\n• Build and simulate circuits in **10 hands-on labs** (drag components, wire ports, run)\n• Validate your wiring with the **Circuit Analyzer**\n• Explore **6 Playground** IoT scenarios (security, door, street light, irrigation, parking, fire & gas)\n• Try **3 Advanced modules** driven by live weather (Environment Advisor, Agriculture AI, Smart Home Twin)\n• Track progress with **XP, levels and badges**, keep **notes** and **favorite** labs\n• Earn a **certificate** after completing all 10 labs",
    next: ["How do I get started?", "How do XP and levels work?", "What is the Playground?"]
  },
  {
    id: "who_built",
    title: "Who built ARCIO?",
    keywords: ["who made arcio", "who built arcio", "who created arcio", "who developed arcio", "developers", "developer", "team", "creators", "made by", "lead developer", "behind arcio", "who is the developer", "who are the developers", "saicharan", "rithika"],
    answer: "ARCIO was built by student developers from **SRM CSE (Batch 2028)**: **Saicharan A S** (Lead Developer) and **Rithika** (Developer).\nFaculty mentors: **Deeba K** (Assoc. Prof., CSE) and **Dr. D. Karthikeyan** (Assoc. Prof., EEE).",
    next: ["Who are the faculty mentors?", "What technology is ARCIO built with?", "What is ARCIO?"]
  },
  {
    id: "mentors",
    title: "Who are the faculty mentors?",
    keywords: ["mentor", "mentors", "faculty mentor", "faculty", "guide", "professor", "who guided", "deeba", "karthikeyan", "mentored by", "teacher", "supervisor"],
    answer: "ARCIO is mentored by **Deeba K** (Associate Professor, CSE) and **Dr. D. Karthikeyan** (Associate Professor, EEE) at SRM Institute of Science and Technology. Their profile links are on the ARCIO home page.",
    next: ["Who built ARCIO?", "What is ARCIO?"]
  },
  {
    id: "who_can_use",
    title: "Is ARCIO only for SRM students?",
    keywords: ["who can use arcio", "only for srm", "other college students", "outside students", "non srm", "external students", "public access", "can anyone use", "which college", "which institute", "srm institute", "srmist", "who is arcio for", "target audience"],
    answer: "ARCIO comes from **SRM Institute of Science and Technology**, and the sign-up form asks for your **SRM mail (@srmist.edu.in)** and registration number — so it's meant for SRM students.\nI don't have information about access for other institutions.",
    next: ["How do I create an account?", "What is ARCIO?"]
  },
  {
    id: "hardware_needed",
    title: "Do I need any hardware?",
    keywords: ["need hardware", "need real arduino", "physical board", "buy components", "need esp32 board", "without hardware", "no hardware", "do i need to buy", "real components", "need any component", "kit required"],
    answer: "No hardware at all. ARCIO is **100% browser-based** — the ESP32 / Arduino UNO, LEDs, sensors, relay, servo and everything else are virtual components you drag onto the canvas.",
    next: ["Which boards does ARCIO support?", "How do I build a circuit?"]
  },
  {
    id: "boards_supported",
    title: "Which boards does ARCIO support?",
    keywords: ["which boards", "supported boards", "which microcontroller", "esp32 or arduino", "nodemcu", "raspberry pi", "stm32", "pic microcontroller", "which board is used", "board used", "arduino uno or esp32", "other boards"],
    answer: "• **Lab 01** uses an **Arduino UNO**\n• **Labs 02–10** use an **ESP32**\nThe Playground and Advanced modules describe the controller as Arduino / ESP32 logic.\nI don't know of support for other boards (like Raspberry Pi or STM32).",
    next: ["What is an ESP32?", "What is Arduino UNO?", "ESP32 vs Arduino UNO"]
  },
  {
    id: "component_library",
    title: "Which components are available?",
    keywords: ["which components", "available components", "component library", "what components", "list of components", "supported components", "sensors available", "what parts can i use", "component list"],
    answer: "Each lab has its own **Component Library** (left panel, searchable). Across the labs you'll find:\n• **Controllers:** Arduino UNO (Lab 01), ESP32 (Labs 02–10)\n• **Inputs:** Push Button, Switch, LDR, Potentiometer, DHT11/DHT22, HC-SR04\n• **Outputs:** LED, Bulb, Buzzer, Servo Motor (Lab 07), Relay Module (Lab 09)\nOnly the parts relevant to a lab appear in that lab's library.",
    next: ["Which lab uses a servo?", "How do I build a circuit?", "What does the lab workspace look like?"]
  },
  {
    id: "tech_stack",
    title: "What technology is ARCIO built with?",
    keywords: ["technology", "tech stack", "built with", "made with", "framework", "programming language", "language used", "backend", "database", "firebase", "hosting", "vercel", "html css javascript", "node express"],
    answer: "ARCIO uses **HTML5, CSS3 and JavaScript** on the front end, a **Node.js + Express** backend, **Firebase** for accounts and profile data, and it's deployed on **Vercel**. The circuit visuals are animated SVG.",
    next: ["Who built ARCIO?", "What is ARCIO?"]
  },
  {
    id: "version_roadmap",
    title: "Which version is ARCIO and what's coming next?",
    keywords: ["version", "roadmap", "upcoming", "future", "coming soon", "planned", "new features", "updates", "release", "what's next for arcio", "future plans"],
    answer: "This is **ARCIO v1.0** (shown in the lab status bar). The project roadmap mentions planned items such as advanced sensors, ESP32 experiments, performance analytics, AI-assisted guidance and faculty evaluation tools.\nI don't have release dates.",
    next: ["What is ARCIO?", "How do I report an issue?"]
  },

  // ───────────────────────── GETTING STARTED ─────────────────────────
  {
    id: "get_started",
    title: "How do I get started?",
    keywords: ["get started", "getting started", "how to start using arcio", "first time", "new here", "where to begin", "beginner guide", "tutorial", "user guide", "how to use arcio", "how does arcio work", "workflow", "steps to use", "guide me"],
    answer: "Quick start:\n1. **Create an account / sign in** on the home page.\n2. Open your **Dashboard** (`/dashboard`).\n3. Pick a lab (start with **Lab 01**) and click **Launch Lab**.\n4. In the workspace: drag components → click ports to wire them → **Analyze Circuit** → **Run Simulation**.\n5. Back on the Dashboard, click **✓ Mark as Completed** to earn XP.\n6. Finish all 10 labs to unlock your **certificate**.",
    next: ["How do I build a circuit?", "How do I mark a lab as completed?", "Which lab should I start with?"]
  },
  {
    id: "start_lab",
    title: "How do I start a lab?",
    keywords: ["start lab", "start a lab", "how to start lab", "launch lab", "open a lab", "run lab", "first lab", "enter lab", "go to lab", "access lab", "open lab from dashboard"],
    answer: "To start a lab:\n1. Open your **Dashboard** (`/dashboard`).\n2. Click any lab card (or hover it and press **▶ Open Lab**).\n3. In the details window, read the objective and parts, then click **Launch Lab** to open the workspace.\nYou can open any lab — nothing is locked.",
    next: ["What does the lab workspace look like?", "How do I build a circuit?", "Which lab should I start with?"]
  },
  {
    id: "lab_workspace",
    title: "What does the lab workspace look like?",
    keywords: ["workspace", "layout", "lab page", "lab screen", "panels", "interface", "canvas", "left panel", "right panel", "what is on the lab page", "lab ui", "simulation playground panel"],
    answer: "Every lab workspace has:\n• **Left – Component Library:** searchable parts you drag out\n• **Center – Simulation canvas:** where you place and wire components\n• **Right – Circuit Analyzer:** components, connections, GPIO mapping, live pin states, circuit health and simulation state\n• **Bottom tabs:** **System Logs**, **Observations** and **Theory**\n• **Top bar:** Reset, Analyze Circuit, Run Simulation, theme toggle and a **Dashboard** link\n• **Status bar:** component count, wire count and latency",
    next: ["How do I build a circuit?", "What are System Logs, Observations and Theory?", "What does Analyze Circuit do?"]
  },
  {
    id: "build_circuit",
    title: "How do I build a circuit?",
    keywords: ["build circuit", "build a circuit", "drag components", "place components", "add component", "wire components", "how to wire", "draw wire", "make connections", "make a circuit", "create circuit", "how to connect components", "connect ports"],
    answer: "To build a circuit in a lab:\n1. **Drag** a component from the Component Library onto the canvas (start with the ESP32 / Arduino UNO).\n2. **Click a port** on one component, then click a port on another to draw a wire. Press `Esc` to cancel a wire.\n3. Move parts by dragging them; select one and press `Delete` to remove it.\n4. Click **Analyze Circuit** to validate, then **Run Simulation**.\nAsk me e.g. *\"Lab 4 wiring\"* for the exact pins of a lab.",
    next: ["What does Analyze Circuit do?", "How do I run the simulation?", "I can't connect wires"]
  },
  {
    id: "analyze_circuit",
    title: "What does Analyze Circuit do?",
    keywords: ["analyze circuit", "circuit analyzer", "validate circuit", "circuit health", "valid circuit", "check circuit", "no controller", "no input device", "no output device", "no connections", "empty circuit", "not analyzed", "circuit invalid", "analyzer panel"],
    answer: "**Analyze Circuit** checks your wiring and sets the **Circuit Health** badge in the right panel:\n• **Empty Circuit** – nothing on the canvas yet\n• **No Controller** – add the ESP32 / Arduino UNO\n• **No Input Device / No Output Device** – add a button/sensor or an LED/buzzer/bulb\n• **No Connections** – parts are placed but not wired\n• **Valid Circuit** ✅ – ready to simulate\nThe analyzer panel also lists your components, connections and GPIO mapping.",
    next: ["How do I run the simulation?", "How do I build a circuit?", "My LED isn't turning on"]
  },
  {
    id: "run_simulation",
    title: "How do I run the simulation?",
    keywords: ["run simulation", "start simulation", "stop simulation", "run button", "simulate circuit", "play simulation", "cannot run", "run the circuit", "how to run", "pause simulation", "simulation state"],
    answer: "Click **Run Simulation** in the top bar (it needs the ESP32 / Arduino UNO on the canvas). The button changes to **Stop Simulation** and the status shows *Simulating*.\nThen interact: press and hold buttons, or drag the sliders on sensors. Watch results in the Circuit Analyzer's **Live State**, plus the **System Logs** and **Observations** tabs.",
    next: ["How do I interact during the simulation?", "What does Analyze Circuit do?", "My LED isn't turning on"]
  },
  {
    id: "interact_sim",
    title: "How do I interact during the simulation?",
    keywords: ["press button", "hold button", "slider", "drag slider", "potentiometer slider", "ldr slider", "change light", "interact", "toggle switch", "simulate light", "change temperature", "move slider", "how to press button", "control the inputs", "change sensor value"],
    answer: "While the simulation runs:\n• **Push Button** – press and hold it with the mouse\n• **Switch** – click it to toggle\n• **Potentiometer / LDR / DHT / HC-SR04** – drag the slider on the component (knob position, light level, temperature & humidity, or distance)\nOutputs (LED, bulb, buzzer, servo, relay) react live.",
    next: ["How do I run the simulation?", "Which lab uses an LDR?", "What are System Logs, Observations and Theory?"]
  },
  {
    id: "reset_delete",
    title: "How do I reset or delete components?",
    keywords: ["reset", "clear canvas", "start over", "delete component", "remove component", "remove wire", "delete wire", "undo", "clear circuit", "erase", "remove part", "reset lab", "reset canvas"],
    answer: "• **Reset** (top bar) clears the canvas so you can start over.\n• To delete one part, select it and press `Delete` (or `Backspace`), or use its small delete control. Removing a component also removes its wires.\nI don't know of a way to delete just a single wire — delete and re-add the part, or Reset.",
    next: ["How do I build a circuit?", "I can't connect wires"]
  },
  {
    id: "smart_inspector",
    title: "What is Smart Inspector?",
    keywords: ["smart inspector", "inspector", "hover component", "component details", "inspect component", "what does this component do", "component info", "hover over component"],
    answer: "The **Smart Inspector** is the info panel that pops up when you **hover over a component** on the canvas. It shows what the part is, how it works (its operating principle), key specs and typical real-world uses — handy for learning while you build.",
    next: ["How do I open the fullscreen board view?", "What does the lab workspace look like?"]
  },
  {
    id: "fullscreen_visualizer",
    title: "How do I open the fullscreen board view?",
    keywords: ["fullscreen visualizer", "fullscreen board", "visualizer", "board view", "double click", "enlarge board", "arduino visualizer", "pin view", "esp32 view", "open board", "maximize board", "expand board"],
    answer: "**Double-click the ESP32 / Arduino UNO** on the canvas to open the **fullscreen board visualizer**. It shows the board's pins with their live states and a small *Circuit Overview*. Click **Back to Canvas** to return.",
    next: ["What is Smart Inspector?", "What does the lab workspace look like?"]
  },
  {
    id: "logs_obs_theory",
    title: "What are System Logs, Observations and Theory?",
    keywords: ["system logs", "logs", "observations", "theory tab", "console", "bottom panel", "serial monitor", "output panel", "clear logs", "where are the readings", "where can i see values", "tabs at the bottom"],
    answer: "The bottom panel of every lab has three tabs:\n• **System Logs** – timestamped events (components placed, simulation started, pin changes…). **Clear** empties it.\n• **Observations** – plain-English notes about what your circuit is doing, including live sensor readings.\n• **Theory** – the lab's aim, components, procedure (with exact pins) and expected output.",
    next: ["Lab 4 wiring", "How do I run the simulation?"]
  },
  {
    id: "code_editor",
    title: "Can I write or upload my own code?",
    keywords: ["write code", "code editor", "upload code", "own code", "custom code", "arduino code", "sketch", "program the board", "edit code", "paste code", "where is the code", "where do i write code", "compile", "ide", "show code", "view code", "reference code", "sample code"],
    answer: "The lab workspace has **no code editor** — each lab's board logic is built into the simulation, and I don't know of a way to upload your own code.\nTo read the reference Arduino code: on the **Dashboard**, hover a lab card and click **⚙ Arduino** → the **Code** tab (there are also Overview, Wiring, Pin Mapping and Libraries tabs).",
    next: ["What is the Arduino button on a lab card?", "How do I build a circuit?"]
  },
  {
    id: "arduino_modal",
    title: "What is the Arduino button on a lab card?",
    keywords: ["arduino button", "arduino reference", "arduino modal", "pin mapping tab", "libraries tab", "wiring tab", "wiring diagram", "reference wiring", "arduino tab", "gear button"],
    answer: "Hovering a lab card on the Dashboard shows **▶ Open Lab**, **⚙ Arduino** and **☆**. The **⚙ Arduino** window is a quick reference with five tabs: **Overview** (expected output + procedure), **Wiring** diagram, **Pin Mapping**, **Code** and **Libraries**.\nIf it says the experiment data hasn't loaded, refresh the page.",
    next: ["Can I write or upload my own code?", "How do I start a lab?"]
  },
  {
    id: "theme_toggle",
    title: "How do I switch between light and dark mode?",
    keywords: ["darkmode", "lightmode", "theme", "change theme", "toggle theme", "dark theme", "white background", "black background", "dark", "brightness of screen", "switch theme", "sun moon icon"],
    answer: "Use the **moon / sun icon** — it's in the Dashboard navbar and in each lab's top bar (and in the bottom-panel tab bar). One click switches between light and dark.",
    next: ["What does the lab workspace look like?", "How do I navigate the dashboard?"]
  },
  {
    id: "back_to_dashboard",
    title: "How do I go back to the dashboard?",
    keywords: ["back to dashboard", "go back", "return to dashboard", "exit lab", "leave lab", "go home", "home page", "back to home", "how to exit"],
    answer: "• In a **lab**: click **Dashboard** at the top-right of the top bar.\n• In the **Playground**: click **Back to Dashboard**.\n• On the **Dashboard**: the **Home** link (top-right) takes you to the ARCIO home page.\nYour progress is kept.",
    next: ["Where is my progress saved?", "How do I navigate the dashboard?"]
  },

  // ───────────────────────── DASHBOARD ─────────────────────────
  {
    id: "dashboard_overview",
    title: "How do I navigate the dashboard?",
    keywords: ["navigate dashboard", "dashboard", "dashboard sections", "dashboard overview", "what is on dashboard", "dashboard features", "labs and playground page", "dashboard guide", "dashboard layout"],
    answer: "Your **Dashboard** (`/dashboard`) contains:\n• **Continue Learning** banner – resume your last lab\n• **Progress cards** – Labs (x/10), Playground (x/6) and Overall %\n• **XP & Level** bar and **Achievement Badges**\n• **Learning Path** – GPIO → Sensors → Actuators → Automation\n• **Recent Activity** and **Favorite Labs**\n• **Search, filters** and grid/table view\n• The **10 lab cards**, **Advanced Labs**, **Recommended Next** and the **IoT Playground**\nThe navbar has your XP/level, theme toggle, profile, Share Feedback and Home.",
    next: ["How is my progress tracked?", "How do I search or filter labs?", "How do XP and levels work?"]
  },
  {
    id: "labs_list",
    title: "Where can I find the labs?",
    keywords: ["list of labs", "all labs", "which labs are there", "available labs", "how many labs", "lab list", "labs available", "core labs", "list experiments", "all experiments", "where are the labs", "find labs", "how many experiments", "number of labs", "show all labs"],
    answer: "ARCIO has **10 core labs** on your Dashboard:\n• **01** LED Blinking using ESP32 *(workspace: Input / Output Simulator)*\n• **02** Push Button Input\n• **03** Potentiometer\n• **04** Automatic Light Detection\n• **05** Temperature Monitoring\n• **06** Buzzer Control\n• **07** Servo Motor Control\n• **08** Ultrasonic Distance Measurement\n• **09** Relay Module Simulation for Appliance Control\n• **10** Smart Home Scene\nPlus **6 Playground simulations** and **3 Advanced modules**. Ask e.g. *\"Lab 5 overview\"* for details.",
    next: ["Which lab should I start with?", "What is the Playground?", "What are the Advanced modules?"]
  },
  {
    id: "recommended_order",
    title: "Which lab should I start with?",
    keywords: ["which lab first", "where to start", "best order", "recommended order", "learning path", "sequence", "beginner lab", "easiest lab", "order of labs", "do i need to complete in order", "prerequisite", "lab order", "path track", "which lab should i do first", "in order"],
    answer: "Start with **Lab 01** and go in order. The **Learning Path** on your Dashboard groups the labs:\n**GPIO** (01–03) → **Sensors** (04–05) → **Actuators** (06–08) → **Automation** (09–10).\nNothing is locked, so you can open any lab, but each one builds on the previous concepts.",
    next: ["Which labs are for beginners?", "Where can I find the labs?", "How long will all the labs take?"]
  },
  {
    id: "progress_tracking",
    title: "How is my progress tracked?",
    keywords: ["progress", "progress bar", "labs completed", "overall progress", "completion percentage", "how is progress calculated", "track progress", "my progress", "progress cards", "percentage"],
    answer: "The Dashboard shows three progress cards: **Labs Completed** (x / 10), **Playground Completed** (x / 6) and **Overall Progress**, which is (labs done + playground done) ÷ 16.\nProgress updates when you click **✓ Mark as Completed** on a lab or playground card.",
    next: ["How do I mark a lab as completed?", "Where is my progress saved?", "How do XP and levels work?"]
  },
  {
    id: "progress_storage",
    title: "Where is my progress saved?",
    keywords: ["progress saved", "save progress", "lost progress", "progress missing", "progress gone", "clear progress", "different device", "another browser", "sync", "backup", "local storage", "is my data saved", "lost xp", "xp gone", "progress disappeared", "progress not showing", "restore progress", "progress is gone", "progress is lost", "lost my progress", "my progress is gone", "xp is gone", "xp reset", "everything reset", "completed labs gone", "new laptop", "switch device"],
    answer: "Your lab progress (completed labs, XP, notes, favorites) is stored **in your browser's local storage, tied to your account**. So:\n• Use the **same account and same browser** to see it again.\n• It does **not** sync to other devices, and clearing site data erases it.\nI don't know of a way to restore lost progress — you can report it via **Share Feedback**.",
    next: ["How do I report an issue?", "How is my progress tracked?"]
  },
  {
    id: "mark_complete",
    title: "How do I mark a lab as completed?",
    keywords: ["mark complete", "mark as completed", "complete lab", "finish lab", "how to complete", "lab completed", "completed button", "submit lab", "how to finish", "mark lab done", "earn xp", "get xp", "how to get xp"],
    answer: "Completion is marked on the **Dashboard**, not inside the lab:\n1. Click the lab's card to open its details window.\n2. Click **✓ Mark as Completed**.\nYou'll see a confetti toast, the lab's XP is added, your progress bars update and the card shows ✔ Done. Do the lab first, then mark it!",
    next: ["How do XP and levels work?", "Can I undo a completed lab?", "How do I get my certificate?"]
  },
  {
    id: "undo_complete",
    title: "Can I undo a completed lab?",
    keywords: ["undo complete", "unmark", "uncomplete", "revert completed", "marked by mistake", "mistake mark complete", "accidentally completed", "remove completion", "undo mark"],
    answer: "I don't know of an undo option — once you click **✓ Mark as Completed** the button turns into a disabled **✓ Completed**. If it was a mistake, tell the team via **Share Feedback**.",
    next: ["How do I report an issue?", "How do I mark a lab as completed?"]
  },
  {
    id: "xp_levels",
    title: "How do XP and levels work?",
    keywords: ["xp", "xp system", "level", "level up", "level names", "how to level up", "experience points", "what is xp", "ranks", "lv", "levels and xp", "how xp works", "max level", "highest level"],
    answer: "You earn **XP** each time you click **✓ Mark as Completed** on a lab (20–50 XP, shown on its card) or a Playground simulation (25–40 XP). Your XP and level appear in the navbar (e.g. *⚡ 120 XP · Lv.3*).\n**Levels:** 1 Newcomer (0) · 2 Tinkerer (50) · 3 Builder (120) · 4 Maker (220) · 5 Explorer (350) · 6 Engineer (500) · 7 Specialist (700) · 8 Expert (950) · 9 Master (1250) · 10 Architect (1600) · 11 Legend (2000).\nAll 10 labs + 6 Playground sims give **" + (TOTAL_LAB_XP + TOTAL_PLAY_XP) + " XP** in total.",
    next: ["How much XP does each lab give?", "What badges can I earn?", "How do I mark a lab as completed?"]
  },
  {
    id: "badges",
    title: "What badges can I earn?",
    keywords: ["badge", "badges", "achievement", "achievements", "which badges", "how to get badges", "trophy", "medals", "unlock badge", "locked badge"],
    answer: "Achievement badges on your Dashboard unlock as you complete labs:\n• 🏅 **First Lab** – complete any 1 lab\n• ⚡ **GPIO Expert** – Labs 01, 02, 03\n• 🌡️ **Sensor Master** – Labs 04, 05\n• ⚙️ **Actuator Pro** – Labs 06, 07, 08\n• 🔧 **Automation Engineer** – Labs 09 and 10\n• 🎓 **Lab Graduate** – all 10 labs",
    next: ["How do XP and levels work?", "How do I get my certificate?"]
  },
  {
    id: "continue_recommended",
    title: "What are Continue Learning and Recommended Next?",
    keywords: ["continue learning", "resume", "recommended next", "what next", "suggestion", "recommendation", "next lab", "resume button", "dismiss banner", "banner at the top", "what should i do next"],
    answer: "• **Continue Learning** (top banner) shows the last lab you opened that isn't finished — click **Resume** to jump back in, or × to hide it.\n• **Recommended Next** suggests your next lab based on what you just completed (e.g. *\"Because you completed Lab 01\"*).",
    next: ["Which lab should I start with?", "What is Recent Activity?"]
  },
  {
    id: "favorites",
    title: "How do I favorite a lab?",
    keywords: ["favorite", "star", "bookmark", "save lab", "pin lab", "starred", "favorite labs", "add to favorites", "star lab", "mark favorite", "favorite list"],
    answer: "Click the **☆ star** on a lab card (or the ☆ in its hover overlay) to favorite it. Favorites appear in the **Favorite Labs** panel on your Dashboard for one-click access. Click the star again to remove it.",
    next: ["What is Recent Activity?", "How do I search or filter labs?"]
  },
  {
    id: "recent_activity",
    title: "What is Recent Activity?",
    keywords: ["recent", "recent activity", "recently opened", "history", "last opened", "recent labs", "previously opened"],
    answer: "**Recent Activity** lists the last few labs you opened (up to 5), so you can jump back quickly.",
    next: ["How do I favorite a lab?", "What are Continue Learning and Recommended Next?"]
  },
  {
    id: "search_filter",
    title: "How do I search or filter labs?",
    keywords: ["search lab", "find lab", "filter", "filter labs", "search box", "categories", "sort labs", "table view", "grid view", "list view", "view toggle", "filter tabs", "search for lab"],
    answer: "Above the lab cards you'll find:\n• A **Search Labs…** box with suggestions as you type\n• **Filter tabs:** All · GPIO · Sensors · Actuators · Automation · Smart Home · Playground\n• A **Grid / Table** view toggle (the table shows title, category, difficulty, time, XP and status)",
    next: ["How do I favorite a lab?", "How do I navigate the dashboard?"]
  },
  {
    id: "notes",
    title: "Can I take notes on a lab?",
    keywords: ["notes", "my notes", "take notes", "save notes", "write notes", "clear notes", "notebook", "note taking", "add notes", "personal notes"],
    answer: "Yes! Open a lab's details window on the Dashboard and use **My Notes** — type, then **Save Notes** (or **Clear Notes**). Notes are saved per lab, in your browser with the rest of your progress.",
    next: ["Where is my progress saved?", "Are there tutorials or videos?"]
  },
  {
    id: "resources",
    title: "Are there tutorials or videos?",
    keywords: ["youtube", "video", "videos", "tutorial", "article", "reading material", "resources", "learn more", "reference link", "study material", "external links", "documentation"],
    answer: "Yes — each lab's details window has **YouTube** and **Article** buttons linking to helpful external tutorials (Lab 10 has two of each). They open in a new tab.",
    next: ["How do I start a lab?", "Can I take notes on a lab?"]
  },
  {
    id: "lab_details_window",
    title: "What is in a lab's details window?",
    keywords: ["lab modal", "lab details", "objective", "popup", "details window", "card details", "hover card", "what happens when i click a lab card", "lab card", "click lab card"],
    answer: "Clicking a lab card opens a details window with:\n• **Objective**, **Components Used** and **Concepts Covered**\n• Badges for difficulty, time, category and XP\n• **My Notes** (save/clear)\n• **✓ Mark as Completed**, **YouTube / Article** links and **Launch Lab**",
    next: ["How do I start a lab?", "How do I mark a lab as completed?"]
  },
  {
    id: "home_page",
    title: "What is on the home page?",
    keywords: ["home page", "homepage", "landing page", "launch simulator", "main page", "front page", "what is on the home page"],
    answer: "The **home page** has the **Launch Simulator** button, the sign-in / create-account panels, an *Any concerns? Let us know.* feedback link, plus the developer and faculty-mentor sections.",
    next: ["How do I log in?", "How do I create an account?"]
  },
  {
    id: "lab_total_time",
    title: "How long will all the labs take?",
    keywords: ["how long will all the labs take", "total time", "time to finish all labs", "total duration", "how many hours", "how much time do labs take", "time needed for all labs", "complete all labs time"],
    answer: "The lab cards estimate **" + TOTAL_LAB_MINS + " minutes (about " + Math.floor(TOTAL_LAB_MINS / 60) + " h " + (TOTAL_LAB_MINS % 60) + " min)** for all 10 labs combined. Each lab is 20–45 minutes — Lab 10 is the longest at 45 min.",
    next: ["How much XP does each lab give?", "Which lab should I start with?"]
  },
  {
    id: "xp_per_lab",
    title: "How much XP does each lab give?",
    keywords: ["xp per lab", "how much xp", "xp for each lab", "total xp", "maximum xp", "max xp", "xp table", "xp values", "xp of each lab", "how many xp"],
    answer: "**Labs:** " + LAB_IDS.map(k => k + ": " + LABS[k].xp).join(" · ") + "  (total **" + TOTAL_LAB_XP + " XP**)\n**Playground:** Security 40 · Door 30 · Street Light 25 · Irrigation 30 · Parking 40 · Fire & Gas 40  (total **" + TOTAL_PLAY_XP + " XP**)\nEverything together: **" + (TOTAL_LAB_XP + TOTAL_PLAY_XP) + " XP**.",
    next: ["How do XP and levels work?", "What badges can I earn?"]
  },

  {
    id: "no_save_share",
    title: "Can I save or share my circuit?",
    keywords: ["save my circuit", "save circuit", "share circuit", "share my circuit", "export circuit", "download circuit", "share with friends", "collaborate", "multiplayer", "leaderboard", "compare with friends", "circuit saved", "load circuit"],
    answer: "I don't know of any option to save, export or share a circuit, or a leaderboard. What ARCIO does keep (in your browser, per account) is your **completed labs, XP, notes and favorites**. If you'd like such a feature, suggest it via **Share Feedback**.",
    next: ["Where is my progress saved?", "How do I report an issue?"]
  },

  // ───────────────────────── ACCOUNT ─────────────────────────
  {
    id: "login",
    title: "How do I log in?",
    keywords: ["login", "how to login", "cannot login", "login failed", "invalid credentials", "wrong password", "login with registration number", "login with regno", "login problem", "sign in problem", "unable to login", "can't sign in", "not registered", "login page"],
    answer: "On the home page use the **Sign In** panel:\n• Enter your **SRM email** *or* your **registration number**, plus your password, then click **Sign In**.\n• *\"Invalid credentials\"* → re-check the email / reg. number and password.\n• *\"Registration number … is not registered\"* → create an account first.\n• Forgot your password? Use **Forgot password?**",
    next: ["I forgot my password", "How do I create an account?", "What is the registration number used for?"]
  },
  {
    id: "register",
    title: "How do I create an account?",
    keywords: ["register", "new account", "join arcio", "make account", "how to register", "create account", "sign up", "registration form", "account creation", "enroll"],
    answer: "On the home page click **Create Account** and fill in:\n• **Full Name**\n• **Registration Number**\n• **Email** – your SRM mail (`@srmist.edu.in`)\n• **Password** (at least 6 characters) and **Confirm Password**\nThen click **Create Account**. Each registration number can be linked to only one account.",
    next: ["What is the registration number used for?", "What are the password rules?", "How do I log in?"]
  },
  {
    id: "regno",
    title: "What is the registration number used for?",
    keywords: ["regno", "registration number format", "roll number", "reg no already used", "registration number already registered", "duplicate registration", "what is reg no", "why registration number", "regno wrong", "use regno to login"],
    answer: "Your **SRM registration number** (like `RA…`) identifies you on ARCIO: you can **log in with it** instead of your email, and each number can only belong to **one account**. It's converted to upper-case automatically, so capitalization doesn't matter.",
    next: ["How do I log in?", "Can I change my name or email?"]
  },
  {
    id: "forgot_password",
    title: "I forgot my password",
    keywords: ["forgot password", "reset password", "change password", "password reset", "lost password", "forgot my password", "cant remember password", "recover account", "reset link", "password recovery"],
    answer: "On the **Sign In** panel:\n1. Type your **email address** in the first box (a registration number won't work for this).\n2. Click **Forgot password?**\n3. A reset link is emailed to you — check your inbox (and spam).\nI don't know of a way to change your password while logged in.",
    next: ["How do I log in?", "What are the password rules?"]
  },
  {
    id: "password_rules",
    title: "What are the password rules?",
    keywords: ["password requirements", "password length", "minimum password", "password rules", "strong password", "password too short", "passwords do not match", "password conditions", "weak password"],
    answer: "Your password must be **at least 6 characters**, and the **Confirm Password** box must match it exactly.",
    next: ["How do I create an account?", "I forgot my password"]
  },
  {
    id: "srm_email",
    title: "Can I use a non-SRM email?",
    keywords: ["non srm email", "personal email", "other email", "email domain", "srmist.edu.in", "srm mail only", "use gmail", "yahoo", "outlook email", "which email", "email required", "college mail"],
    answer: "The sign-up and sign-in forms say **\"Use your SRM mail only! (@srmist.edu.in)\"**. I don't have information about using other email domains.",
    next: ["How do I create an account?", "Is ARCIO only for SRM students?"]
  },
  {
    id: "logout",
    title: "How do I sign out?",
    keywords: ["logout", "exit account", "switch account", "how to logout", "sign off", "log off", "change user"],
    answer: "On the Dashboard, click your **name** (top-right) to open your profile, then click **Sign Out**.",
    next: ["How do I view my profile?", "How do I log in?"]
  },
  {
    id: "profile",
    title: "How do I view my profile?",
    keywords: ["profile", "my profile", "account details", "my account", "view profile", "name button", "profile window", "certificate status", "my details", "account type"],
    answer: "Click your **name** at the top-right of the Dashboard. The profile window shows your **Full Name, Registration Number, Email, Account Type (Student)** and **Certificate Status** (Issued / Not Issued). You can **Sign Out** from there.",
    next: ["Can I change my name or email?", "How do I sign out?"]
  },
  {
    id: "edit_profile",
    title: "Can I change my name or email?",
    keywords: ["change name", "edit profile", "update profile", "change email", "update email", "change registration number", "wrong registration number", "edit name", "modify profile", "correct my name", "wrong name", "wrong details"],
    answer: "I don't know of a way to edit these — the profile window is read-only. If your name, email or registration number is wrong, please tell the team through **Share Feedback**.",
    next: ["How do I report an issue?", "How do I view my profile?"]
  },
  {
    id: "delete_account",
    title: "Can I delete my account?",
    keywords: ["delete account", "delete my account", "remove my account", "close my account", "remove account", "deactivate", "close account", "delete my data", "remove my data", "erase account"],
    answer: "I don't know — I have no information about deleting an account. Please raise it through **Share Feedback**.",
    next: ["How do I report an issue?", "What data does ARCIO store about me?"]
  },
  {
    id: "privacy",
    title: "What data does ARCIO store about me?",
    keywords: ["privacy", "my data", "data stored", "personal data", "who can see", "data safe", "secure", "security of my data", "data protection", "what data", "is it safe"],
    answer: "Your **name, registration number and email** are stored with your ARCIO account (Firebase). Your **lab progress, XP and notes** stay in your browser.\nBeyond that I don't know who can view the data or what the policy is — please ask your faculty mentors.",
    next: ["Where is my progress saved?", "Who are the faculty mentors?"]
  },
  {
    id: "login_required",
    title: "Why am I sent back to the home page?",
    keywords: ["redirected", "redirect", "taken to home", "asks login again", "session expired", "logged out automatically", "cant open dashboard", "dashboard not opening", "sent back to home", "kicked out", "keeps logging out"],
    answer: "The Dashboard, labs and Playground need you to be **signed in**. If you're sent back to the home page, your session has ended or you're not signed in — sign in again and you'll land on the Dashboard.",
    next: ["How do I log in?", "I forgot my password"]
  },

  // ───────────────────────── CERTIFICATE ─────────────────────────
  {
    id: "certificate",
    title: "How do I get my certificate?",
    keywords: ["certificate", "get certificate", "certificate generation", "when is my certificate generated", "generate certificate", "how to get certificate", "certificate of completion", "where is my certificate", "claim certificate"],
    answer: "To get your certificate:\n1. **Complete all 10 core labs** (click **✓ Mark as Completed** on each).\n2. A gold **🏆 Certificate** button appears in the Dashboard navbar.\n3. Click it and type your **full name** — ⚠ it is **permanently locked** on the certificate.\n4. Click **Generate & Lock Certificate**, then **Print** or **Download PDF**.\nPlayground and Advanced modules are not required.",
    next: ["What do I need for the certificate?", "Can I change the name on my certificate?", "How do I download or print my certificate?"]
  },
  {
    id: "certificate_requirements",
    title: "What do I need for the certificate?",
    keywords: ["certificate requirement", "eligible", "eligibility", "certificate unlock", "certificate button missing", "certificate not showing", "when can i get certificate", "how many labs for certificate", "do i need playground for certificate", "certificate locked", "cant see certificate", "certificate button not appearing", "certificate not visible"],
    answer: "You need **all 10 core labs marked as completed** (Labs Completed = 10 / 10). Only then does the **🏆 Certificate** button appear in the navbar. Playground simulations and Advanced modules do **not** count towards it.\nIf you finished all labs but don't see the button, refresh the Dashboard and check that each lab shows ✔ Done.",
    next: ["How do I mark a lab as completed?", "How is my progress tracked?", "How do I get my certificate?"]
  },
  {
    id: "certificate_name",
    title: "Can I change the name on my certificate?",
    keywords: ["change certificate name", "wrong name on certificate", "edit certificate", "certificate name locked", "mistake in certificate name", "spelling mistake certificate", "certificate name wrong", "edit name on certificate", "correct certificate name"],
    answer: "No — the name is **permanently locked** once you click *Generate & Lock Certificate*. I don't know of a way to change it afterwards, so if there's a mistake please contact the team via **Share Feedback**.",
    next: ["How do I report an issue?", "How do I get my certificate?"]
  },
  {
    id: "certificate_download",
    title: "How do I download or print my certificate?",
    keywords: ["download certificate", "print certificate", "certificate pdf", "save certificate as pdf", "certificate print", "get certificate pdf", "certificate download button", "save certificate"],
    answer: "Open your certificate, then click **🖨️ Print Certificate** or **📥 Download PDF**. Both open your browser's print dialog — choose **Save as PDF** as the destination to download it, or pick a printer to print it.",
    next: ["What does the certificate show?", "How do I get my certificate?"]
  },
  {
    id: "certificate_contents",
    title: "What does the certificate show?",
    keywords: ["certificate contents", "certificate details", "certificate id", "verified", "certificate look", "what is on certificate", "sample certificate", "certificate design", "certificate information"],
    answer: "It's an SRM Institute of Science and Technology **Certificate of Completion** for the *ARCIO Virtual Arduino Laboratory*, showing your **name**, **award date**, **experiments completed (10 / 10)**, **total XP**, a **Certificate ID** (like `ARCIO-2026-0726-001`), a ✓ **Verified** status and an official ARCIO seal.",
    next: ["How do I download or print my certificate?", "How do I get my certificate?"]
  },

  // ───────────────────────── PLAYGROUND ─────────────────────────
  {
    id: "playground",
    title: "What is the Playground?",
    keywords: ["playground", "interactive playground", "playground modules", "smart systems", "iot playground", "playground simulations", "what is playground", "how to use playground", "open playground", "how many simulations", "playground list", "real world simulations"],
    answer: "The **IoT Playground** has **6 ready-made simulations** — no wiring needed, just interact with the scene:\n1. **Smart Security** – drag a person into the camera zone\n2. **Automatic Door** – ultrasonic sensor opens the door\n3. **Street Light Automation** – Day/Night toggle\n4. **Smart Irrigation** – soil-moisture slider\n5. **Smart Parking** – park cars in 6 slots\n6. **Fire & Gas Safety** – simulate a hazard\nOpen them from the **IoT Playground** section of the Dashboard (**▶ Launch**), or the Playground page.",
    next: ["Playground vs labs", "How much XP does each lab give?", "Tell me about Smart Parking"]
  },
  {
    id: "playground_vs_labs",
    title: "Playground vs labs",
    keywords: ["playground vs labs", "difference between playground and labs", "playground and lab difference", "labs vs playground", "how is playground different", "playground or labs"],
    answer: "• **Labs (10):** you *build* the circuit yourself — place components, wire ports, analyze and run.\n• **Playground (6):** finished real-world IoT scenes you *interact with* (drag a person, flip day/night, drag a slider) to see sensors, controller and outputs work together.\nBoth give XP, but only the 10 labs count for the certificate.",
    next: ["What is the Playground?", "How do I get my certificate?"]
  },
  {
    id: "play_security",
    title: "Tell me about Smart Security",
    keywords: ["smart security", "security system", "security playground", "intrusion", "intruder", "security simulation", "camera detection", "alarm system", "pir sensor", "beacon"],
    answer: "**Smart Security** (Playground, Advanced, +40 XP): a facility floor plan monitored by a camera/motion system. **Drag the person** around — when they enter the camera's detection zone, the **alarm and beacon activate**, the detection count rises and the console logs the event. Concepts: motion detection, automation, alert systems.",
    next: ["Tell me about the Automatic Door", "What is the Playground?"]
  },
  {
    id: "play_door",
    title: "Tell me about the Automatic Door",
    keywords: ["automatic door", "auto door", "door", "door system", "door simulation", "door playground", "sliding door", "door sensor", "door opens"],
    answer: "**Automatic Door** (Playground, Intermediate, +30 XP): an HC-SR04 **ultrasonic sensor** measures distance. **Drag the person toward the door** — when they come within the **150 cm** threshold the door motor opens it; when they leave it auto-closes. The panel shows distance, door status and an access log.",
    next: ["Tell me about Street Light Automation", "What is the Playground?"]
  },
  {
    id: "play_streetlight",
    title: "Tell me about Street Light Automation",
    keywords: ["streetlight", "street light automation", "street light simulation", "street lamp", "streetlight playground", "day night toggle", "energy saved", "auto street light"],
    answer: "**Street Light Automation** (Playground, Beginner, +25 XP): flip the **Day / Night toggle**. An LDR reads the light level (threshold **200 lux**) and the lamp switches on in darkness. The panel shows light intensity, lamp status, power consumption and energy saved.",
    next: ["Tell me about Smart Irrigation", "Which lab uses an LDR?"]
  },
  {
    id: "play_irrigation",
    title: "Tell me about Smart Irrigation",
    keywords: ["irrigation", "smart irrigation", "soil moisture", "water pump", "irrigation simulation", "irrigation playground", "moisture slider", "smart farm", "plant watering"],
    answer: "**Smart Irrigation** (Playground, Intermediate, +30 XP): drag the **Soil Moisture slider** (0–100%). When moisture drops below the **40%** threshold, the controller switches the **relay-driven water pump ON** and the plant recovers. The panel shows moisture level, pump status, water usage, raw ADC value and voltage.",
    next: ["Tell me about Smart Parking", "Tell me about Agriculture AI"]
  },
  {
    id: "play_parking",
    title: "Tell me about Smart Parking",
    keywords: ["smart parking", "parking", "parking system", "parking simulation", "parking slots", "parking playground", "vehicle occupancy", "park car", "ir sensor parking"],
    answer: "**Smart Parking** (Playground, Advanced, +40 XP): a 6-slot parking lot. **Drag the car** into a green slot to park it; hover an occupied slot and tap it to let that vehicle leave. IR sensors update available slots, occupied slots, vehicle count and occupancy rate live. There's also an **Auto Traffic** mode and **Reset**.",
    next: ["Tell me about Fire & Gas Safety", "What is the Playground?"]
  },
  {
    id: "play_fire",
    title: "Tell me about Fire & Gas Safety",
    keywords: ["fire and gas safety", "fire safety", "gas safety", "gas leak", "gas sensor", "fire simulation", "smoke", "hazard", "simulate hazard", "emergency", "ventilation", "mq2", "fire playground", "flame sensor"],
    answer: "**Fire & Gas Safety** (Playground, Advanced, +40 XP): press **⚠ Simulate Hazard** to release gas/smoke. The sensor detects the rising PPM level, then the system automatically **sounds the alarm, shuts the valve and runs the ventilation fan**. Press **Reset** to try again.",
    next: ["Tell me about Smart Security", "What is the Playground?"]
  },

  // ───────────────────────── ADVANCED MODULES ─────────────────────────
  {
    id: "advanced_modules",
    title: "What are the Advanced modules?",
    keywords: ["advanced modules", "advance", "advanced labs", "ai modules", "arcio live", "advanced section", "advanced simulators", "live modules", "3 modules", "what are advanced labs"],
    answer: "ARCIO has **3 Advanced modules** that combine live weather data with an Arduino decision engine (find them under **Advanced Labs** on the Dashboard):\n1. **Environment Advisor** (`/advance/env_advisor`) – real-time conditions → fan, window, pump, LED, relay, LCD, buzzer\n2. **Agriculture AI** (`/advance/agricultureai`) – smart-farm digital twin\n3. **Smart Home Twin** (`/advance/smarthome_twin`) – interactive smart-home digital twin",
    next: ["Tell me about the Environment Advisor", "Tell me about Agriculture AI", "Tell me about the Smart Home Twin"]
  },
  {
    id: "adv_env",
    title: "Tell me about the Environment Advisor",
    keywords: ["environment advisor", "env advisor", "context aware", "environment module", "live environment", "arcio live environment", "decision engine", "real time environmental"],
    answer: "**Environment Advisor** (ARCIO Live) turns real weather into Arduino decisions. It reads your location's temperature, humidity, wind and rain, feeds them to a virtual Arduino and shows what it switches: **Fan, Servo/Window, Pump, LED, Relay, LCD, Buzzer**, with an *AI Reasoning* panel explaining each decision. Use **Try It** buttons (Storm, Heavy Rain, Night Mode…) to test conditions.",
    next: ["What are Try It and Simulate it?", "Where does the live data come from?", "The advanced module can't find my location"]
  },
  {
    id: "adv_agri",
    title: "Tell me about Agriculture AI",
    keywords: ["agriculture ai", "agri", "agricultural ai", "farm module", "precision farming", "smart farm ai", "crop", "plant health", "water savings", "agriculture module", "farming"],
    answer: "**Agriculture AI** (ARCIO Agri) is a smart-farm digital twin: live weather drives soil, sky and an Arduino that decides when to **water, shade or do nothing**. It controls a Pump, Relay, Water Valve, Servo, Grow Light and Fan, and shows **Plant Health**, estimated **water saved** and **irrigation efficiency**. Soil readings are *estimated* from weather (no soil hardware).",
    next: ["What are Try It and Simulate it?", "Tell me about Smart Irrigation", "Where does the live data come from?"]
  },
  {
    id: "adv_home",
    title: "Tell me about the Smart Home Twin",
    keywords: ["smart home twin", "smarthome twin", "home twin", "smart home digital twin", "home module", "smart home module", "energy dashboard", "security status", "my home"],
    answer: "**Smart Home Twin** (marked *Beta*) is an interactive digital twin of a house. Real weather feeds virtual sensors and an Arduino control hub that decides what happens to the **Ceiling Fan, AC, Lights, Window Servo, Door Lock, Garage Door, Water Pump, Security Alarm and Curtains**. You can simulate events like *Person Arrives, Smoke Detected, Gas Leak, Strong Wind*. It also has an **Energy Dashboard** and **Security Status**. Indoor readings are simulated.",
    next: ["What are Try It and Simulate it?", "Smart home lab vs Smart Home Twin", "Where does the live data come from?"]
  },
  {
    id: "smarthome_ambiguous",
    title: "Smart home lab vs Smart Home Twin",
    keywords: ["smarthome", "smart home", "smarthome lab", "smarthome vs twin", "smarthome scene vs twin", "home automation", "smart home difference", "smart home"],
    answer: "There are two smart-home things in ARCIO:\n• **Lab 10 – Smart Home Scene:** a build-it-yourself circuit (button + LDR + LED + buzzer on an ESP32).\n• **Smart Home Twin:** an Advanced module — a live digital-twin house driven by real weather.\nWhich one would you like to know about?",
    next: ["Lab 10 overview", "Tell me about the Smart Home Twin"]
  },
  {
    id: "adv_data",
    title: "Where does the live data come from?",
    keywords: ["live data", "weather data", "open meteo", "api", "data source", "real data", "real time weather", "real or simulated", "is the data real", "where does weather come from", "weather api", "geocoding"],
    answer: "The Advanced modules use live weather from **Open-Meteo** and place search from **OpenStreetMap Nominatim** — no API keys or login needed. Some readings are *simulated*: soil values in Agriculture AI are estimated from weather, and indoor readings in Smart Home Twin are simulated (no hardware connected).",
    next: ["The advanced module can't find my location", "What are the Advanced modules?"]
  },
  {
    id: "adv_location",
    title: "The advanced module can't find my location",
    keywords: ["location", "locate me", "permission", "geolocation", "gps", "allow location", "wrong location", "change location", "city search", "awaiting location", "location denied", "detecting location", "values show dashes", "no data in advanced module", "advanced module blank"],
    answer: "The Advanced modules ask your browser for **location permission**. Fixes:\n• Click **Locate Me** and choose **Allow** in the browser prompt.\n• If you denied it, type a city into the location box and click **Search**.\n• Click **Refresh** to reload data. Values show `--` until data arrives, and you need an internet connection.",
    next: ["Where does the live data come from?", "What are Try It and Simulate it?"]
  },
  {
    id: "adv_try_it",
    title: "What are Try It and Simulate it?",
    keywords: ["try it", "change conditions", "simulate it", "simulated conditions", "back to live", "heavy rain", "storm", "what if", "simulate weather", "build it", "try this in playground", "launch playground button"],
    answer: "In each Advanced module:\n• **Try It / Change the Conditions** – buttons like ▲Temperature, Heavy Rain, Storm, Night, Dry Soil… override the live data so you can watch the Arduino react. The banner says *Simulated conditions — live data paused*; click **Back to Live** to return.\n• **Simulate it!** opens a deeper simulator for that module.\n• **Build It** links to the Playground so you can try the idea yourself.",
    next: ["What are the Advanced modules?", "What is the Playground?"]
  },

  // ───────────────────────── LAB CONCEPT GLOSSARY ─────────────────────────
  {
    id: "c_iot",
    title: "What is IoT?",
    keywords: ["iot", "internet of things", "what is iot", "define iot", "iot meaning", "iot basics"],
    answer: "**IoT (Internet of Things)** means physical devices — sensors, controllers and actuators — that sense the world, make decisions and act (and often connect to the internet). Every ARCIO lab follows that pattern: **sensor/input → microcontroller logic → output**.",
    next: ["Sensor vs actuator", "What is a digital twin?", "Where can I find the labs?"]
  },
  {
    id: "c_sensor_actuator",
    title: "Sensor vs actuator",
    keywords: ["sensor vs actuator", "what is a sensor", "what is an actuator", "sensor", "actuator", "input and output devices", "input devices", "output devices", "difference between sensor and actuator"],
    answer: "• A **sensor / input** measures the world: push button, LDR, potentiometer, DHT, HC-SR04.\n• An **actuator / output** acts on it: LED, buzzer, servo, relay, bulb.\nThe microcontroller reads inputs, applies logic, and drives outputs.",
    next: ["What is IoT?", "Which components are available?"]
  },
  {
    id: "c_gpio",
    title: "What is GPIO?",
    keywords: ["gpio", "what is gpio", "general purpose input output", "gpio pin", "digital pin", "pinmode", "what is a pin", "high low", "logic level", "digitalwrite", "digitalread", "digital output", "digital input"],
    answer: "**GPIO** (General-Purpose Input/Output) pins are the board's programmable pins. Configured as an **output** they drive HIGH (on) or LOW (off) — like lighting an LED (Labs 01, 02). As an **input** they read HIGH/LOW — like a button. You'll see them in the analyzer's **GPIO Mapping** and **Live State**.",
    next: ["Lab 2 wiring", "What is PWM?", "Digital vs analog"]
  },
  {
    id: "c_pwm",
    title: "What is PWM?",
    keywords: ["pwm", "pulse width modulation", "what is pwm", "duty cycle", "ledc", "ledcwrite", "analogwrite", "brightness control", "frequency and duty"],
    answer: "**PWM** switches a pin ON/OFF very fast; the fraction of time it's ON (**duty cycle**) sets the average power. In ARCIO: **Lab 03** dims an LED (duty 0–255), **Lab 06** changes the buzzer *frequency* to make tones, and **Lab 07** uses pulse width to set a servo angle.",
    next: ["Lab 3 overview", "Lab 6 overview", "What is a servo motor?"]
  },
  {
    id: "c_adc",
    title: "What is ADC?",
    keywords: ["adc", "analog to digital", "analog read", "analogread", "12 bit", "4095", "adc value", "analog input", "what is adc", "analog to digital converter", "adc resolution"],
    answer: "An **ADC** (Analog-to-Digital Converter) turns a varying voltage into a number. The ESP32's ADC is **12-bit**, so readings go from **0 to 4095**. Labs **03** (potentiometer), **04** (LDR) and **10** (LDR) read analog values this way.",
    next: ["What is an LDR?", "Digital vs analog", "Lab 3 overview"]
  },
  {
    id: "c_digital_analog",
    title: "Digital vs analog",
    keywords: ["digital vs analog", "analog vs digital", "difference between digital and analog", "digital signal", "analog signal", "what is analog", "what is digital"],
    answer: "• **Digital** signals have two states: HIGH or LOW (button, LED on/off).\n• **Analog** signals vary continuously (potentiometer, LDR) and are read with an **ADC**.\nLabs 01–02 are digital; Labs 03–04 introduce analog.",
    next: ["What is ADC?", "What is GPIO?"]
  },
  {
    id: "c_ldr",
    title: "What is an LDR?",
    keywords: ["ldr", "light dependent resistor", "photoresistor", "what is ldr", "light sensor", "how ldr works", "ldr sensor", "ambient light"],
    answer: "An **LDR** (Light Dependent Resistor) changes its resistance with light — more light, lower resistance. With a 10kΩ resistor as a **voltage divider**, the ESP32's ADC can read the light level. Used in **Lab 04**, **Lab 10** and the Street Light playground.",
    next: ["Lab 4 overview", "What is a voltage divider?", "Which lab uses an LDR?"]
  },
  {
    id: "c_voltage_divider",
    title: "What is a voltage divider?",
    keywords: ["voltage divider", "10k resistor with ldr", "pull down with ldr", "why 10k resistor", "divider circuit"],
    answer: "A **voltage divider** uses two resistors (here the LDR and a 10kΩ resistor) to turn a changing resistance into a changing voltage the ADC can measure. That's how Lab 04 and Lab 10 read light levels.",
    next: ["What is an LDR?", "What is ADC?"]
  },
  {
    id: "c_resistors",
    title: "Why do we use a 220Ω resistor with an LED?",
    keywords: ["220 ohm", "220 resistor", "why resistor", "resistor with led", "current limiting", "led resistor", "resistor", "resistors", "what is a resistor", "10k resistor", "10kohm", "why 220"],
    answer: "An LED can draw too much current and burn out, so a **220Ω resistor** limits it to a safe ~20 mA. The **10kΩ** resistors in Labs 02, 04 and 10 act as **pull-down/pull-up** (buttons) or as the **voltage-divider** partner (LDR).",
    next: ["What is a pull-up / pull-down resistor?", "What is an LED?"]
  },
  {
    id: "c_pullup",
    title: "What is a pull-up / pull-down resistor?",
    keywords: ["pull up", "pull down", "pull-up", "pull-down", "pullup", "pulldown", "floating input", "input_pullup", "pull up resistor", "pull down resistor"],
    answer: "A **pull-up / pull-down resistor** gives an input pin a definite default level (HIGH or LOW) when the button isn't pressed, so it doesn't \"float\" randomly. Lab 02 uses a 10kΩ resistor for this.",
    next: ["What is button debouncing?", "Lab 2 overview"]
  },
  {
    id: "c_debounce",
    title: "What is button debouncing?",
    keywords: ["debounce", "debouncing", "button bounce", "bouncing", "switch bounce", "button debounce"],
    answer: "Real buttons \"bounce\" — the contact flickers HIGH/LOW for a few milliseconds when pressed. **Debouncing** (a short delay or filtering) makes the microcontroller register just one clean press. It's a concept covered in **Lab 02**.",
    next: ["What is a pull-up / pull-down resistor?", "Lab 2 overview"]
  },
  {
    id: "c_led",
    title: "What is an LED?",
    keywords: ["led", "what is led", "light emitting diode", "led polarity", "led legs", "anode cathode", "led positive", "led how it works"],
    answer: "An **LED** (Light Emitting Diode) lights up when current flows the right way (positive leg to the signal, negative to GND) and needs a **220Ω resistor** to limit current. It's the main output in Labs 01–05, 08 and 10.",
    next: ["Why do we use a 220Ω resistor with an LED?", "Lab 1 overview"]
  },
  {
    id: "c_buzzer",
    title: "Active vs passive buzzer",
    keywords: ["active vs passive buzzer", "active buzzer", "passive buzzer", "buzzer types", "what is a buzzer", "buzzer", "how buzzer works", "buzzer frequency", "tone"],
    answer: "• An **active buzzer** has a built-in oscillator — power it and it beeps at one fixed tone.\n• A **passive buzzer** needs a PWM signal — you choose the **frequency**, so you can play different tones.\nLab 06 uses a passive buzzer (alternating 1000 Hz / 1500 Hz).",
    next: ["Lab 6 overview", "What is PWM?"]
  },
  {
    id: "c_dht",
    title: "What is the DHT11 / DHT22 sensor?",
    keywords: ["dht", "dht11", "dht22", "temperature sensor", "humidity sensor", "what is dht", "temperature and humidity sensor", "single wire", "how dht works"],
    answer: "The **DHT11 / DHT22** measures temperature and humidity and sends both to the microcontroller over a **single data wire** (with a pull-up resistor). The DHT22 is more accurate. **Lab 05** reads it on GPIO 4 and lights a Heat Alert LED at 32°C or above.",
    next: ["Lab 5 overview", "Lab 5 wiring"]
  },
  {
    id: "c_ultrasonic",
    title: "How does the HC-SR04 ultrasonic sensor work?",
    keywords: ["hcsr04", "ultrasonic", "ultrasonic sensor", "how ultrasonic works", "time of flight", "echo", "trig", "trigger pin", "distance sensor", "sonar", "pulsein", "distance formula", "speed of sound"],
    answer: "The **HC-SR04** sends a 40 kHz sound pulse from **Trig**, and the **Echo** pin stays HIGH for as long as the sound takes to bounce back. Distance (cm) = (echo time × speed of sound) ÷ 2 — about 58 µs per cm. Range is roughly 2–400 cm. Used in **Lab 08** and the Automatic Door / Smart Parking playgrounds.",
    next: ["Lab 8 overview", "Lab 8 wiring"]
  },
  {
    id: "c_relay",
    title: "How does a relay work?",
    keywords: ["relay", "what is relay", "relay module", "com no nc", "com", "normally open", "normally closed", "how relay works", "relay switching", "electrical isolation", "relay contacts"],
    answer: "A **relay** is an electrically-operated switch: a small GPIO signal energizes a coil that moves the **COM** contact onto **NO** (normally open) to power a bigger load like a bulb, fan or pump — with electrical isolation between the two circuits. **NC** is the normally-closed contact. See **Lab 09**.",
    next: ["Lab 9 overview", "Lab 9 wiring"]
  },
  {
    id: "c_servo",
    title: "What is a servo motor?",
    keywords: ["servo", "servo motor", "what is servo", "sg90", "servo angle", "how servo works", "servo 90 degree", "esp32servo"],
    answer: "A **servo motor** (like the SG90) rotates its shaft to a specific **angle (0°–180°)** set by the width of a PWM pulse. In **Lab 07** holding the button moves it to 90° and releasing returns it to 0°. It uses the ESP32Servo library on real hardware.",
    next: ["Lab 7 overview", "What is PWM?"]
  },
  {
    id: "c_potentiometer",
    title: "What is a potentiometer?",
    keywords: ["potentiometer", "what is potentiometer", "variable resistor", "knob", "wiper", "pot", "how potentiometer works"],
    answer: "A **potentiometer** is a 3-terminal variable resistor. Turning the knob moves the **wiper**, which outputs a voltage between 0 and the supply. Wired to A0 in **Lab 03**, the ESP32's ADC reads it (0–4095) and maps it to LED brightness.",
    next: ["Lab 3 overview", "What is ADC?"]
  },
  {
    id: "c_breadboard",
    title: "What is a breadboard?",
    keywords: ["breadboard", "what is breadboard", "jumper wires", "jumper wire", "prototyping board", "what are jumper wires"],
    answer: "A **breadboard** lets you connect components without soldering, using **jumper wires**. On ARCIO you don't need one — you just click ports to draw virtual wires — but the lab cards list it as part of the real-world parts.",
    next: ["How do I build a circuit?", "Which components are available?"]
  },
  {
    id: "c_esp32",
    title: "What is an ESP32?",
    keywords: ["esp32", "what is esp32", "esp32 board", "dual core", "esp32 wifi", "esp32 features", "why esp32", "tensilica"],
    answer: "The **ESP32** is a dual-core, Wi-Fi-enabled microcontroller with a **12-bit ADC**, PWM and many GPIO pins. It's the board used in **Labs 02–10**.",
    next: ["ESP32 vs Arduino UNO", "Which boards does ARCIO support?"]
  },
  {
    id: "c_uno",
    title: "What is Arduino UNO?",
    keywords: ["arduino", "arduino uno", "what is arduino", "uno", "atmega328p", "arduino board", "uno r3", "arduino uno r3"],
    answer: "The **Arduino UNO** is a beginner-friendly board built around the **ATmega328P** microcontroller with 14 digital pins. ARCIO uses it in **Lab 01** (button on Pin 2, LED on Pin 13).",
    next: ["ESP32 vs Arduino UNO", "Lab 1 overview"]
  },
  {
    id: "c_esp_vs_uno",
    title: "ESP32 vs Arduino UNO",
    keywords: ["esp32 vs arduino", "arduino vs esp32", "difference between esp32 and arduino", "esp32 or arduino uno", "esp32 arduino difference", "compare esp32 arduino uno", "which is better esp32 or arduino"],
    answer: "• **Arduino UNO** (ATmega328P): simple and beginner-friendly, 14 digital pins — used in Lab 01.\n• **ESP32** (dual-core, Wi-Fi, 12-bit ADC): more powerful, used in Labs 02–10.\nIn ARCIO they behave the same way for basic I/O; the ESP32 adds analog ADC readings, PWM channels and Wi-Fi capability.",
    next: ["What is an ESP32?", "What is Arduino UNO?"]
  },
  {
    id: "c_threshold",
    title: "What is a threshold in these labs?",
    keywords: ["threshold", "threshold logic", "what is threshold", "cutoff", "trigger value", "set point", "thresholds in labs"],
    answer: "A **threshold** is a cut-off value that turns a sensor reading into a decision. In ARCIO: Lab 04 light < **50%** = dark; Lab 05 temperature ≥ **32°C**; Lab 08 distance < **20 cm**; Door playground **150 cm**; Street Light **200 lux**; Irrigation **40%** moisture.",
    next: ["Lab 4 overview", "Lab 8 overview", "Lab 5 overview"]
  },
  {
    id: "c_digital_twin",
    title: "What is a digital twin?",
    keywords: ["digitaltwin", "digital twin", "twin", "what is a digital twin", "virtual twin", "digital twin meaning"],
    answer: "A **digital twin** is a live virtual copy of a real system. ARCIO's Advanced modules (Agriculture AI, Smart Home Twin) mirror a farm or house, feed them real weather, and show what a controller would do in response.",
    next: ["What are the Advanced modules?", "Where does the live data come from?"]
  },
  {
    id: "c_serial_monitor",
    title: "Is there a Serial Monitor?",
    keywords: ["serial monitor", "serial print", "serial output", "serial.println", "print values", "see readings", "baud rate"],
    answer: "ARCIO doesn't have a separate Serial Monitor window. Sensor values (like the ADC reading in Lab 03 or temperature in Lab 05) appear in the **Observations** panel, the **System Logs** and the analyzer's **Live State**.",
    next: ["What are System Logs, Observations and Theory?", "Lab 5 overview"]
  },

  // ───────────────────────── TROUBLESHOOTING ─────────────────────────
  {
    id: "troubleshooting",
    title: "Something isn't working",
    keywords: ["problem", "lab not working", "simulation problem", "troubleshoot", "something wrong", "blank page", "page not loading", "slow", "lag", "not loading", "white screen", "website not working", "site not opening", "troubleshooting"],
    answer: "Try these steps:\n1. **Refresh** the page.\n2. Click **Reset** in the lab top bar to clear the canvas and start again.\n3. Make sure you're **signed in** and connected to the internet (sign-in, fonts and libraries load online).\n4. Use a current desktop browser and disable ad-block extensions if the page stays blank.\n5. Still stuck? Report it via **Share Feedback**.\nTell me what's not working (e.g. *LED not turning on*, *can't connect wires*) for specific help.",
    next: ["My LED isn't turning on", "I can't connect wires", "How do I report an issue?"]
  },
  {
    id: "led_not_on",
    title: "My LED isn't turning on",
    keywords: ["led not glowing", "led not turning on", "led not lighting", "led off", "bulb not glowing", "no output", "output not working", "buzzer not sounding", "led problem", "led wont turn on", "nothing lights up", "nothing happens", "led not working", "output problem", "led problem"],
    answer: "Check these in order:\n1. Is the simulation **running**? (the button should say *Stop Simulation*)\n2. Are the **ESP32 / Arduino and the LED wired** to the correct GPIO? Ask me *\"Lab N wiring\"* for the exact pins.\n3. Does **Analyze Circuit** say *Valid Circuit*?\n4. Did you trigger the input — **press and hold the button**, or drag the sensor slider past the threshold?\n5. Check the **Live State** panel to see whether the GPIO is going HIGH.",
    next: ["What does Analyze Circuit do?", "How do I interact during the simulation?", "Lab 4 wiring"]
  },
  {
    id: "wire_problem",
    title: "I can't connect wires",
    keywords: ["cant connect wire", "wire not connecting", "port not clicking", "connect ports", "draw wire problem", "wire disappears", "cannot wire", "wire not drawing", "unable to connect", "how to fix wires", "wire problem", "wire not working", "wire issue"],
    answer: "Wiring tips:\n• **Click a port first** (it highlights), then click the target port on another component.\n• Press `Esc` if you get stuck mid-wire, then start again.\n• Make sure both components are actually on the canvas and not overlapping.\n• Removing a component also removes its wires — use **Reset** to start fresh.",
    next: ["How do I build a circuit?", "How do I reset or delete components?"]
  },
  {
    id: "arduino_data_error",
    title: "The Arduino button says experiment data has not loaded",
    keywords: ["experiment data has not loaded", "arduino button not working", "arduino modal not opening", "arduino window error", "data has not loaded", "arduino popup error"],
    answer: "That message means the reference data didn't load in time. **Refresh the Dashboard** and try **⚙ Arduino** again. If it keeps happening, report it via **Share Feedback**.",
    next: ["What is the Arduino button on a lab card?", "How do I report an issue?"]
  },
  {
    id: "browser_device",
    title: "Which browser or device should I use?",
    keywords: ["which browser", "browser support", "best browser", "chrome", "firefox", "safari", "mobile", "works on mobile", "work on mobile", "on my phone", "on phone", "on mobile", "on tablet", "on ipad", "on android", "on iphone", "use on laptop", "which device", "screen size", "mobile friendly", "does it work on phone", "responsive design"],
    answer: "I don't have official browser/device information. The lab workspace relies on **mouse drag-and-drop, press-and-hold and the `Delete` key**, so I'd recommend a **laptop or desktop with a current browser** (Chrome, Edge, Firefox or Safari) for the best experience.",
    next: ["Something isn't working", "How do I report an issue?"]
  },
  {
    id: "offline",
    title: "Does ARCIO work offline?",
    keywords: ["offline", "no internet", "without internet", "internet required", "need internet", "wifi required", "work offline", "internet connection"],
    answer: "You need an **internet connection** to sign in and load ARCIO's fonts and libraries. I don't have information about offline use.",
    next: ["Something isn't working", "How do I log in?"]
  },
  {
    id: "feedback",
    title: "How do I report an issue?",
    keywords: ["feedback", "share feedback", "report problem", "report bug", "suggestion", "grievance", "complaint", "concern", "contact", "contact team", "email developers", "any concerns", "report a bug", "give feedback", "suggest feature", "request feature", "support", "reach the team", "how to contact"],
    answer: "We welcome your feedback and reports! Click **Share Feedback** in the Dashboard navbar (or the **\"Any concerns? Let us know.\"** link on the Home page) to open the official feedback form in a new tab.",
    action: "feedback",
    next: ["Something isn't working", "What is ARCIO?"]
  }
];

// -----------------------------------------------------------------------------
// 4. ENGINE  – index, scoring
// -----------------------------------------------------------------------------
const THRESH = 9;      // confident match
const LOW = 8;         // "did you mean…?" zone

const INDEX = CHATBOT_KNOWLEDGE.map(entry => {
  const phrases = [...new Set([entry.title, ...entry.keywords].map(norm).filter(Boolean))];
  const tokens = new Set();
  phrases.forEach(p => tokenize(p).forEach(t => tokens.add(t)));
  return { entry, phrases, tokens };
});

const DF = new Map();
INDEX.forEach(({ tokens }) => tokens.forEach(t => DF.set(t, (DF.get(t) || 0) + 1)));
const N_DOCS = INDEX.length;
const idf = t => (DF.has(t) ? Math.log(1 + N_DOCS / DF.get(t)) : 0);
const ALL_TOKENS = [...DF.keys()];

function scoreEntry(item, qNorm, qTokens) {
  let phraseScore = 0;
  let tokenScore = 0;
  let phraseHit = false;
  const matched = [];
  const padded = " " + qNorm + " ";

  for (const p of item.phrases) {
    if (padded.includes(" " + p + " ")) {
      // a lone generic word (e.g. "phone") only counts when it is the whole question
      if (!p.includes(" ") && p !== qNorm && !inDomain(stem(p))) continue;
      phraseHit = true;
      const pt = tokenize(p);
      const w = pt.reduce((n, t) => n + idf(t), 0);
      phraseScore += 2 * w + (pt.length > 1 ? 3 * pt.length : 0);
      if (p === qNorm) phraseScore += 9;
    }
  }
  for (const t of qTokens) {
    if (item.tokens.has(t)) {
      tokenScore += 3 * idf(t);
      matched.push(t);
    } else if (t.length >= 5) {
      const max = t.length >= 8 ? 2 : 1;
      for (const k of item.tokens) {
        if (k.length >= 5 && k[0] === t[0] && editDistance(t, k, max) <= max) {
          tokenScore += 1.8 * idf(k);
          matched.push(k);
          break;
        }
      }
    }
  }
  // a single loose word (no phrase match) only counts if it is real ARCIO vocabulary
  if (!phraseHit && matched.length <= 1 && !matched.some(inDomain)) return 0;
  // two loose words are fine only if at least one is ARCIO vocabulary
  if (!phraseHit && !matched.some(inDomain)) return 0;
  return phraseScore + tokenScore;
}

function rankKnowledge(qNorm) {
  const qTokens = [...new Set(tokenize(qNorm))];
  return INDEX
    .map(item => ({ entry: item.entry, score: scoreEntry(item, qNorm, qTokens) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Project vocabulary. (a) tells us a question is *about ARCIO* even when we have no answer,
// (b) a lone word may only trigger an answer if it is one of these — this is what stops
// "weather in chennai" or "write me a poem" from being answered by accident.
const DOMAIN_TOKENS = new Set((
  "lab dashboard playground simulator esp32 arduino uno certificate xp badge level workspace canvas circuit " +
  "component sensor actuator led bulb buzzer servo relay ldr dht gpio pwm adc wire iot srm login logout register " +
  "regno password profile advance twin digitaltwin analyzer potentiometer ultrasonic hcsr04 resistor breadboard " +
  "threshold debounce debouncing streetlight irrigation parking hazard gas smarthome note favorite theme darkmode " +
  "lightmode feedback progress inspector fullscreen log observation theory voltage pin port slider temperature " +
  "humidity moisture pump alarm firebase vercel button switch echo trig duty analog digital wifi jumper voltage " +
  "arcio complete continue resume recommend simulation start reset leaderboard door karthikeyan deeba saicharan rithika mentor faculty developer"
).split(/\s+/).map(stem));

const inDomain = t => DOMAIN_TOKENS.has(t);

// -----------------------------------------------------------------------------
// 5. LAB ANSWER BUILDERS  (dynamic answers for "lab 4 wiring", "exp 7 xp" …)
// -----------------------------------------------------------------------------
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const pad2 = n => String(n).padStart(2, "0");

function findLabNumbers(qNorm) {
  const found = [];
  const re = /\blab\s+(?:no\s+|num\s+|number\s+)?((?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(?:and|or|vs|versus|to|with|compare|comma)\s+(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten))*)\b/g;
  let m;
  while ((m = re.exec(qNorm))) {
    m[1].split(/\s+/).forEach(tok => {
      const n = /^\d+$/.test(tok) ? parseInt(tok, 10) : NUM_WORDS[tok];
      if (n >= 1 && n <= 10) {
        const id = pad2(n);
        if (!found.includes(id)) found.push(id);
      }
    });
  }
  return found;
}

// name -> lab (checked in order; composite labs first)
const LAB_NAME_ALIASES = [
  ["10", /\bsmarthome scene\b|\bmini smarthome\b|\bsmarthome lab\b|\bsmarthome automation\b/],
  ["09", /\brelay\b/],
  ["08", /\bultrasonic\b|\bhcsr04\b|\bdistance measurement\b|\bdistance sensor\b/],
  ["07", /\bservo\b/],
  ["06", /\bbuzzer\b/],
  ["05", /\bdht\b|\btemperature\b|\bhumidity\b/],
  ["04", /\bldr\b|\blight detection\b|\bautomatic light\b/],
  ["03", /\bpotentiometer\b|\banalog sensor\b|\banalog reading\b/],
  ["02", /\bbutton input\b|\bdigital input\b/],
  ["01", /\bblink\b|\bblinking\b|\binput output\b|\bio simulator\b/]
];

function findLabByName(qNorm) {
  for (const [id, re] of LAB_NAME_ALIASES) if (re.test(qNorm)) return id;
  return null;
}

const ASPECTS = [
  ["problem",   /\bproblem\b/],
  ["threshold", /\b(threshold|cutoff|limit|trigger value)\b/],
  ["wiring",    /\b(wire|pin|gpio|circuit|setup|diagram|schematic|port|a0)\b/],
  ["components",/\b(component|need|require|kit|bom|drag|library)\b/],
  ["expected",  /\b(expected|output|result|outcome|should happen|what happens|observe|behavior|behaviour|happen)\b/],
  ["xp",        /\b(xp|reward)\b/],
  ["time",      /\b(time|long|duration|minute|minutes|hours?)\b/],
  ["difficulty",/\b(difficult|difficulty|hard|easy|beginner|intermediate|advanced|tough|complex|level)\b/],
  ["concepts",  /\b(concept|theory|topic|skill|cover|learn|teach)\b/],
  ["code",      /\b(code|program|sketch|firmware)\b/],
  ["interact",  /\b(interact|control|slider|press|hold|move|drag)\b/],
  ["next",      /\b(next|after|before|previous|prerequisite)\b/],
  ["overview",  /\b(objective|aim|purpose|overview|summary|explain|describe|about|detail|details|info|information)\b/]
];

function detectAspect(qNorm) {
  for (const [name, re] of ASPECTS) if (re.test(qNorm)) return name;
  return null;
}

const head = id => `**Lab ${id} — ${LABS[id].title}**`;

function labChips(id, skip) {
  const n = parseInt(id, 10);
  const opts = [
    ["wiring", `Lab ${n} wiring`],
    ["expected", `Lab ${n} expected output`],
    ["components", `Lab ${n} components`],
    ["problem", `Lab ${n} not working`]
  ].filter(([a]) => a !== skip).map(([, t]) => t);
  const chips = opts.slice(0, 2);
  if (n < 10) chips.push(`Lab ${n + 1} overview`);
  else chips.push("Tell me about the Smart Home Twin");
  return chips;
}

function labOverview(id) {
  const l = LABS[id];
  let t = `${head(id)}\n_${l.level} · ${l.mins} min · +${l.xp} XP · ${l.board}_\n${l.aim}\n**Concepts:** ${l.concepts.join(", ")}`;
  if (l.note) t += `\n${l.note}`;
  return t;
}

function labAnswer(id, aspect) {
  const l = LABS[id];
  const n = parseInt(id, 10);
  switch (aspect) {
    case "wiring":
      return { text: `${head(id)} — **wiring** (${l.board}):\n${l.wiring.map(w => "• " + w).join("\n")}\nThen click **Analyze Circuit** → **Run Simulation**.`, aspect };
    case "components":
      return { text: `${head(id)} — **components**\n• **Parts list (lab card):** ${l.parts.join(", ")}\n• **Drag from the Component Library:** ${l.drag.join(", ")}`, aspect };
    case "expected":
      return { text: `${head(id)} — **expected output**\n${l.expected}\n**How to interact:** ${l.interact}`, aspect };
    case "xp":
      return { text: `${head(id)} gives **+${l.xp} XP** when you click **✓ Mark as Completed** on the Dashboard.`, aspect };
    case "time":
      return { text: `${head(id)} takes about **${l.mins} minutes**.`, aspect };
    case "difficulty":
      return { text: `${head(id)} is rated **${l.level}** (${l.mins} min, +${l.xp} XP).`, aspect };
    case "concepts":
      return { text: `${head(id)} — **concepts covered:** ${l.concepts.join(", ")}.`, aspect };
    case "threshold":
      return { text: l.threshold
        ? `${head(id)} — **threshold:** ${l.threshold}.`
        : `${head(id)} doesn't use a sensor threshold. ${l.expected}`, aspect };
    case "interact":
      return { text: `${head(id)} — **how to interact:** ${l.interact}`, aspect };
    case "code":
      return { text: `${head(id)}: the workspace has no code editor — the logic is built in. To read the reference Arduino code, go to the Dashboard → hover the lab card → **⚙ Arduino** → **Code** tab.`, aspect };
    case "problem":
      return { text: `${head(id)} — if it isn't working:\n1. Wire exactly: ${l.wiring.map(w => w.replace(/\*\*/g, "")).join("; ")}.\n2. Click **Analyze Circuit** — it should say *Valid Circuit*.\n3. Click **Run Simulation**, then: ${l.interact}\n4. Still stuck? Click **Reset** and rebuild, or use **Share Feedback**.`, aspect };
    case "next": {
      const nx = n < 10 ? `Next up is **Lab ${pad2(n + 1)} — ${LABS[pad2(n + 1)].title}**.` : "This is the last core lab — after it, complete all 10 to unlock your certificate!";
      const pv = n > 1 ? ` Before it comes Lab ${pad2(n - 1)} — ${LABS[pad2(n - 1)].title}.` : "";
      return { text: `${head(id)} is in the **${l.cat}** group.${pv} ${nx}`, aspect };
    }
    default:
      return { text: labOverview(id), aspect: "overview" };
  }
}

function compareLabs(ids) {
  const [a, b] = ids;
  const row = id => `**Lab ${id} — ${LABS[id].title}**\n${LABS[id].level} · ${LABS[id].mins} min · +${LABS[id].xp} XP · ${LABS[id].board}\nParts to drag: ${LABS[id].drag.join(", ")}\nAim: ${LABS[id].aim}`;
  return row(a) + "\n\n" + row(b);
}

// which lab uses <component>?
const COMPONENT_LOOKUP = [
  [/\bbutton\b/, "Push Button", ["01", "02", "07", "10"]],
  [/\bled\b/, "LED", ["01", "02", "03", "04", "05", "08", "10"]],
  [/\bpotentiometer\b/, "Potentiometer", ["03"]],
  [/\bldr\b/, "LDR", ["04", "10"]],
  [/\bdht\b/, "DHT11/DHT22", ["05"]],
  [/\bbuzzer\b/, "Buzzer", ["06", "10"]],
  [/\bservo\b/, "Servo Motor", ["07"]],
  [/\b(ultrasonic|hcsr04)\b/, "HC-SR04 ultrasonic sensor", ["08"]],
  [/\brelay\b/, "Relay Module", ["09"]],
  [/\bbulb\b/, "Bulb", ["09"]],
  [/\bswitch\b/, "Switch", ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]],
  [/\besp32\b/, "ESP32", ["02", "03", "04", "05", "06", "07", "08", "09", "10"]],
  [/\b(arduino|uno)\b/, "Arduino UNO", ["01"]]
];

function whichLabUses(qNorm) {
  const asks = /\b(which|what)\s+lab\b/.test(qNorm) ||
    /^lab\s+(use|uses|using|with|has|have)\b/.test(qNorm) ||
    /\b(where|which|what)\b.*\b(is|are)?\s*(used|uses)\b/.test(qNorm);
  if (!asks) return null;
  if (findLabNumbers(qNorm).length) return null;
  for (const [re, name, ids] of COMPONENT_LOOKUP) {
    if (re.test(qNorm)) {
      const list = ids.map(id => `• **Lab ${id}** — ${LABS[id].title}`).join("\n");
      return { text: `The **${name}** is used in:\n${list}`, chips: ids.slice(0, 2).map(id => `Lab ${parseInt(id, 10)} overview`) };
    }
  }
  return null;
}

function difficultyList(qNorm) {
  if (/\b(modules?|playground|section|location|twin|advanced labs?|advance)\b/.test(qNorm)) return null;
  if (!/\blab\b/.test(qNorm) && !/\b(beginner|easiest|hardest|advanced|intermediate)\b/.test(qNorm)) return null;
  const mk = (title, ids) => ({
    text: `${title}\n` + ids.map(id => `• **Lab ${id}** — ${LABS[id].title} (${LABS[id].mins} min, +${LABS[id].xp} XP)`).join("\n"),
    chips: ids.slice(0, 2).map(id => `Lab ${parseInt(id, 10)} overview`)
  });
  const by = lvl => LAB_IDS.filter(k => LABS[k].level === lvl);
  if (/\b(beginner|easiest|easy|simple|basic|starter)\b/.test(qNorm)) return mk("**Beginner labs:**", by("Beginner"));
  if (/\b(hardest|hard|toughest|tough|difficult|most difficult|challenging|complex)\b/.test(qNorm) || /\badvanced\b/.test(qNorm))
    return mk("**Hardest lab (Advanced):**", by("Advanced"));
  if (/\bintermediate\b/.test(qNorm)) return mk("**Intermediate labs:**", by("Intermediate"));
  if (/\b(longest|longest time|most time)\b/.test(qNorm)) return mk("**Longest lab:**", ["10"]);
  if (/\b(shortest|quickest|fastest)\b/.test(qNorm)) return mk("**Shortest labs (20 min):**", LAB_IDS.filter(k => LABS[k].mins === 20));
  if (/\b(most xp|highest xp|maximum xp)\b/.test(qNorm)) return mk("**Most XP:**", ["10"]);
  return null;
}

function xpToLevel(qNorm) {
  const m = qNorm.match(/\b(\d{1,5})\s*xp\b|\bxp\s*(\d{1,5})\b/);
  if (!m || !/\b(level|lv)\b/.test(qNorm)) return null;
  const xp = parseInt(m[1] || m[2], 10);
  const lv = levelForXp(xp);
  const next = LEVEL_THRESHOLDS[lv + 1];
  return `With **${xp} XP** you'd be **Level ${lv + 1} — ${LEVEL_NAMES[lv]}**.` + (next ? ` Next level at ${next} XP.` : " That's the max level!");
}

// -----------------------------------------------------------------------------
// 6. SMALL TALK
// -----------------------------------------------------------------------------
function smallTalk(qNorm) {
  const t = qNorm.trim();
  const words = t.split(/\s+/).filter(Boolean);

  const greet = /^(hi+|hello+|hey+|hola|yo|sup|namaste|vanakkam|good (morning|afternoon|evening)|hii+|heyy+)( there| bot| arcio| everyone)?$/;
  if (greet.test(t)) {
    return { text: "Hi there! 👋 I'm the **ARCIO Help Assistant**. Ask me about labs, the workspace, XP, your certificate, the Playground or your account — or tap a suggestion below.", chips: CHATBOT_SUGGESTED_PROMPTS.slice(0, 4) };
  }
  if (/\b(thanks|thank you|thankyou|appreciate|cheers)\b/.test(t) && words.length <= 6) {
    return { text: "You're welcome! 😊 Anything else I can help you with?", chips: ["How do I start a lab?", "How do I get my certificate?"] };
  }
  if (/\b(bye|goodbye|see you|cya|good night|take care|gtg)\b/.test(t) && words.length <= 5) {
    return { text: "Bye! Happy building — come back anytime you need help with ARCIO. 👋", chips: [] };
  }
  if (/^(how are you|how are you doing|hows it going|how do you do|whats up|wassup|how is it going)$/.test(t)) {
    return { text: "I'm doing great, thanks for asking! Ready to help you with ARCIO — what would you like to know?", chips: CHATBOT_SUGGESTED_PROMPTS.slice(0, 3) };
  }
  if (/\b(who are you|what are you|your name|are you a bot|are you an ai|are you human|are you real|are you chatgpt|are you gpt|are you gemini|are you claude|who made you|who built you|who created you|what is your name)\b/.test(t)) {
    return { text: "I'm the **ARCIO Help Assistant** — a simple built-in bot that answers from ARCIO's own help topics. I'm not a live AI service, so if something isn't in my topics, I'll tell you I don't know.", chips: ["What can you help me with?", "What is ARCIO?"] };
  }
  if (t === "help" || t === "menu" || t === "options" || t === "topics" || t === "commands" ||
      /\b(what can you (do|help)|what can i ask|what do you know|how can you help|your (features|abilities|capabilities)|things you can|topics you)\b/.test(t) ||
      /^(help me|need help|i need help|can you help me)$/.test(t)) {
    return {
      text: "I can help with:\n• **Labs** – wiring, components, expected output, XP for any lab (try *\"Lab 4 wiring\"*)\n• **Workspace** – building circuits, Analyze Circuit, running simulations\n• **Dashboard** – progress, XP & levels, badges, notes, favorites\n• **Certificate** – requirements, name, download\n• **Playground & Advanced modules**\n• **Account** – login, register, password\n• **Concepts** – GPIO, PWM, ADC, LDR, relay, servo…\nAnything else, I'll honestly say I don't know.",
      chips: ["Where can I find the labs?", "How do XP and levels work?", "What are the Advanced modules?"]
    };
  }
  if (/\b(good bot|great bot|nice bot|well done|good job|great job|awesome bot|you are (great|awesome|good|helpful|amazing|nice)|love you|nice work|super)\b/.test(t) && words.length <= 6) {
    return { text: "Thank you, that's kind! 😊 Let me know if you need anything else about ARCIO.", chips: [] };
  }
  if (/^(ok+|okay|k|kk|cool|fine|nice|sure|alright|got it|understood|yes|yeah|yep|no|nope|nothing|nah|hmm+|oh+|wow|great|perfect)$/.test(t)) {
    return { text: "Alright! Let me know if you have any other question about ARCIO.", chips: CHATBOT_SUGGESTED_PROMPTS.slice(0, 3) };
  }
  return null;
}

// -----------------------------------------------------------------------------
// 7. CONVERSATION CONTEXT  (remembers the last lab so "and its wiring?" works)
// -----------------------------------------------------------------------------
const ctx = { lastLab: null };

export function resetChatbotContext() {
  ctx.lastLab = null;
}

function reply(text, chips, extra) {
  return Object.assign({ text, followups: (chips || []).slice(0, 3) }, extra || {});
}

function fallbackReply(qNorm, ranked) {
  const near = ranked.filter(r => r.score >= LOW).slice(0, 3);
  if (near.length) {
    return reply("I'm not completely sure what you meant. Did you mean one of these?", near.map(r => r.entry.title), { kind: "clarify" });
  }
  const qt = tokenize(qNorm);
  const inScope = qt.some(t => DOMAIN_TOKENS.has(t)) || /\barcio\b/.test(qNorm);
  return reply(inScope ? FALLBACK_IN_SCOPE : FALLBACK_OUT_OF_SCOPE, FALLBACK_CHIPS, { kind: "unknown" });
}

// -----------------------------------------------------------------------------
// 8. MAIN ENTRY POINT
//    queryChatbot("lab 4 wiring")  ->  { text, followups:[…], kind, action? }
// -----------------------------------------------------------------------------
export function queryChatbot(userInput) {
  const raw = String(userInput || "").slice(0, 300);
  if (!raw.trim()) {
    return reply("Type a question about ARCIO — for example *\"How do I start a lab?\"* — or tap a suggestion.", CHATBOT_SUGGESTED_PROMPTS.slice(0, 3), { kind: "empty" });
  }

  let q = norm(raw);
  if (!q) return fallbackReply("", []);

  // ---- 1. small talk (also strips a leading greeting: "hi, how do I login")
  const st = smallTalk(q);
  if (st) return reply(st.text, st.chips, { kind: "smalltalk" });
  q = q.replace(/^(hi+|hello+|hey+|hola|yo|namaste|good (morning|afternoon|evening))\s+/, "").trim() || q;

  // ---- 2. XP -> level calculator ("what level is 300 xp")
  const lvl = xpToLevel(q);
  if (lvl) return reply(lvl, ["How do XP and levels work?", "What badges can I earn?"], { kind: "answer" });

  // ---- 3. lab-specific questions
  const nums = findLabNumbers(q);
  const aspect = detectAspect(q);
  const explicitLab = nums.length > 0;

  if (nums.length >= 2 && /\b(vs|versus|compare|difference|differ|between)\b/.test(q)) {
    ctx.lastLab = nums[0];
    return reply(compareLabs(nums), [`Lab ${parseInt(nums[0], 10)} wiring`, `Lab ${parseInt(nums[1], 10)} wiring`], { kind: "answer" });
  }

  if (explicitLab) {
    ctx.lastLab = nums[0];
    if (nums.length >= 2 && aspect && aspect !== "overview") {
      const parts = nums.slice(0, 3).map(id => labAnswer(id, aspect).text);
      return reply(parts.join("\n\n"), labChips(nums[0], aspect), { kind: "answer" });
    }
    const a = labAnswer(nums[0], aspect);
    return reply(a.text, labChips(nums[0], a.aspect), { kind: "answer" });
  }

  // component -> labs, difficulty lists
  const who = whichLabUses(q);
  if (who) return reply(who.text, who.chips, { kind: "answer" });
  const diff = difficultyList(q);
  if (diff) return reply(diff.text, diff.chips, { kind: "answer" });

  // ---- 4. rank the static knowledge base
  const ranked = rankKnowledge(q);
  const best = ranked[0];

  // lab named by component/topic ("servo lab", "ldr wiring")
  const byName = findLabByName(q);
  const namedAsLab = byName && !/\b(vs|versus|twin|digitaltwin)\b/.test(q) && (/\blab\b/.test(q) || (aspect && aspect !== "overview"));
  if (namedAsLab) {
    ctx.lastLab = byName;
    const a = labAnswer(byName, aspect);
    return reply(a.text, labChips(byName, a.aspect), { kind: "answer" });
  }

  // follow-up with no lab named: "and its wiring?", "what about xp?", "next lab"
  if (!best || best.score < THRESH) {
    if (ctx.lastLab && aspect) {
      const a = labAnswer(ctx.lastLab, aspect);
      return reply(a.text, labChips(ctx.lastLab, a.aspect), { kind: "answer" });
    }
    if (!ctx.lastLab && aspect && ["wiring", "components", "expected", "threshold", "concepts", "code", "interact"].includes(aspect) && /\blab\b|\bwire\b|\bpin\b|\bcomponent\b/.test(q)) {
      return reply("Which lab do you mean? Tell me the lab number, for example *\"Lab 4 wiring\"*.", ["Where can I find the labs?", "Lab 1 wiring", "Lab 5 wiring"], { kind: "clarify" });
    }
  }

  // a topic name alone that maps to a lab and no glossary hit ("relay") is handled by KB above;
  // if the KB is unsure but a lab name matches, show that lab
  if ((!best || best.score < THRESH) && byName) {
    ctx.lastLab = byName;
    const a = labAnswer(byName, aspect);
    return reply(a.text, labChips(byName, a.aspect), { kind: "answer" });
  }

  // ---- 5. answer from the knowledge base
  if (best && best.score >= THRESH) {
    const chips = best.entry.next || [];
    let text = best.entry.answer;
    const second = ranked[1];
    const multi = /\b(and|also|plus)\b|[?&,]/.test(raw) && (raw.match(/\?/g) || []).length + (/\b(and|also|plus)\b/.test(q) ? 1 : 0) >= 1;
    if (multi && second && second.entry.id !== best.entry.id && second.score >= THRESH && second.score >= 0.75 * best.score) {
      text += "\n\n———\n\n" + second.entry.answer;
    }
    const extra = { kind: "answer", id: best.entry.id };
    if (best.entry.action) extra.action = best.entry.action;
    // opening a glossary entry about a lab component keeps a lab as context
    return reply(text, chips, extra);
  }

  // ---- 6. "I don't know" / did-you-mean
  return fallbackReply(q, ranked);
}

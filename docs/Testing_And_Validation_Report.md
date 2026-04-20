# Debugging, Testing, and Validation Report
**Project Title:** Smart Parking Lot Management System (PLM)
**Technology Stack:** Node.js, Express, MongoDB, Socket.io, Vanilla JS/Bootstrap, Tesseract.js (OCR)

---

## 1. Objectives of Testing and Validation
The primary objective of the testing and validation phase is to ensure that the Parking Lot Management System is robust, secure, and functions seamlessly in real-time. Specifically, the objectives are to:
1. **Ensure Data Integrity:** Verify that database operations (MongoDB) involving vehicle entry, exit, and billing do not result in data loss or double-assigned parking slots.
2. **Validate Security (RBAC):** Ensure Role-Based Access Control (Admin vs. Security limits) strictly enforces authorization using JSON Web Tokens (JWT).
3. **Hardware/Software Integration:** Validate the accuracy and performance of the OCR module (Tesseract.js) used for automatic license plate scanning.
4. **Real-time Consistency Check:** Confirm that WebSockets (Socket.io) broadcast dashboard updates instantaneously to all active web terminals without dropped frames.

---

## 2. Debugging Methodologies
To identify and resolve bugs during the development lifecycle, both client-side and server-side debugging techniques were heavily utilized:

* **Server-Side Debugging (Node.js/Express):** 
  * Implemented structured console logging and error catching for all REST API endpoints.
  * Utilized `nodemon` for continuous development and crash monitoring.
  * Tested isolated API endpoints using tools like **Postman** to verify JSON payloads before hooking them to the frontend UI.
* **Database Debugging (MongoDB):** 
  * Monitored query performance and debugged schema validation constraints (e.g., unique username enforcements) directly through **MongoDB Compass**.
* **Client-Side Debugging (Frontend):** 
  * Extensively used **Browser Developer Tools (Chrome DevTools)**. 
  * Relied on the *Console* tab to resolve Vanilla JS DOM manipulation errors, and the *Network* tab to trace and inspect `fetch` requests (verifying standard HTTP vs OPTIONS/CORS preflights) and ensure JWT headers were correctly attached.
* **Real-time Debugging:**
  * Added event-listener logging to track Socket.io `connect`, `parkingUpdate`, and `disconnect` payloads to resolve websocket multi-firing issues.

---

## 3. Testing Phases

### 3.1 Unit Testing
Unit testing focused on specific, isolated functions within the project:
* **Authentication Unit:** Verified that `bcrypt.js` correctly hashes the password string (`pre-save` hook in Mongoose model) and that reverse-validation works natively.
* **Routing Logic:** Validated isolated utility functions, such as the `cleanPlateNumber` regex formatting, to guarantee all inputs are sanitized.
* **Model Validation:** Tested Mongoose schemas structurally for required keys, enums (e.g., role `admin` vs `security`), and default dates.

### 3.2 Integration Testing
Integration testing ensured that independent modules talk to each other correctly:
* **Frontend-Backend Integration:** Verified that asynchronous JavaScript `API fetch` loops handle server HTTP Status Codes successfully (Handling `401 Unauthorized` elegantly by logging out the user dynamically).
* **Automated Data Cascading:** Verified that when a vehicle is checked out, the endpoint not only completes the log document (adding an exit time) but also cleanly broadcasts a WebSocket event to re-render the frontend grid.

### 3.3 Functional Testing
Functional testing ensured project features met business requirements:
* **Role-Based Access:** 
  * *Test Case:* Security guard attempts to navigate to `admin.html`. 
  * *Expected/Actual:* Frontend detects role block and redirects to standard Entry panel; Node backend restricts API data calls by throwing standard 401 exceptions.
* **Slot Auto-Assignment:** 
  * *Test Case:* User clicks "Auto-assign" without a defined slot.
  * *Expected/Actual:* Backend parses employee license plates, correlates them with employee clusters (Blocks A/B), and automatically calculates and returns the next empty spatial string. 
* **OCR Plate Validation:** 
  * *Test Case:* Uploading a live video stream of a plate. 
  * *Expected/Actual:* Canvas successfully freezes the HTML5 video element, translates the image chunk via Tesseract, parses alphanumeric text, and fills the web form field.

### 3.4 Performance and Stress Testing
* **Socket Loading:** Verified that multiple browser tabs maintaining active WebSockets simultaneously do not trigger Node memory leaks.
* **OCR Delay Handling:** Checked edge cases for slow initialization of the Tesseract worker over slow networks; validated that the frontend displays loading spinners to prevent user dual-submissions.

---

## 4. Validation Results
The validation phase compared the built system against initial university project requirements:
1. **Security Validated:** JWT authentication successfully locks out rogue HTTP traffic. Passwords are comprehensively encrypted at rest preventing database eavesdropping.
2. **Operational Success:** Multi-terminal testing demonstrated that a vehicle entering on Terminal A immediately registers on Terminal B’s dashboard within ~100ms.
3. **Data Constraint Viability:** Attempting to double-park a vehicle inside an occupied slot actively returns expected soft system errors ("Slot currently occupied"), proving state stability.

## 5. Conclusion
Through systematic debugging, rigorous functional testing paths, and real-time environment validation, the Parking Lot Management System operates with high stability. The separation of concerns (Frontend UI, REST logic, Mongoose schematics) minimized coupling errors, resulting in a cohesive, deployment-ready prototype.

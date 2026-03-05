
// Funcție helper pentru a citi body-ul JSON al unui request
export const readJSON = (req) => {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                // Dacă body-ul e gol, returnăm null, altfel parsăm
                const parsed = body ? JSON.parse(body) : null;
                resolve(parsed);
            } catch (err) {
                reject(err);
            }
        });
        req.on("error", (err) => reject(err));
    });
};

// Funcție helper pentru a trimite răspunsuri standardizate
export const sendJSON = (res, statusCode, data) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
};

export const sendError = (res, statusCode, message) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
};
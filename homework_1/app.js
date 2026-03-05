import Indexer from "./engine/Indexer.js";
import  {Table, TableORM}  from "./engine/Storage.js";
import http from "node:http";
import { URL } from "node:url";
import chalk from "chalk";

// const interval = setInterval(async () => {
    

//     const newTable = await Table.create("products",{"name":"id","columns":[{"name":"id","type":"number"}]})
//     const tableOrm = new TableORM("products");
//     await tableOrm.init();
//     // await tableOrm.create({id:1});
//     await tableOrm.delete("5b4816cc-f5e1-4ac0-ae96-082c3ede90c7");

//     clearInterval(interval);
// },1000);

const server = http.createServer(async (req,res) => {

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Root
    if(pathname === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello World!");
        return;
    }

    // GET /tables - List all tables with schema
    if(pathname === "/tables" && req.method === "GET"){
        try {
            const tablesData = Indexer.getTables();
            const tablesWithSchema = {};

            for (const [tableName, tableInfo] of Object.entries(tablesData)) {
                try {
                    const table = new Table(tableName);
                    const schema = await table.getTableSchema(tableName);
                    tablesWithSchema[tableName] = {
                        name: tableName,
                        path: tableInfo.path,
                        schema: schema
                    };
                } catch (err) {
                    console.error(`Error reading schema for ${tableName}:`, err);
                    tablesWithSchema[tableName] = {
                        name: tableName,
                        path: tableInfo.path,
                        schema: null
                    };
                }
            }

            res.writeHead(200, {"Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok", 
                code: 200,
                message: "Retrieved all tables successfully",
                count: Object.keys(tablesWithSchema).length,
                data: tablesWithSchema
            }));
        } catch (err) {
            res.writeHead(500, {"Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "error",
                code: 500,
                message: "Internal server error while retrieving tables"
            }));
        }
        return;
    }

    // POST /tables - Create table
    if(pathname === "/tables" && req.method === "POST"){
        let body = "";
        req.on("data", chunk => {
            body += chunk;
        });
        req.on("end", async () => {
            try {
                const parsed = JSON.parse(body);
                
                const newTable = await Table.create(parsed);
                
                if(!newTable){
                    res.writeHead(409, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ 
                        status: "error",
                        code: 409,
                        message: "Table already exists",
                        table: parsed.name
                    }));
                    return;
                }

                res.writeHead(201, { 
                    "Content-Type": "application/json",
                    "Location": `/tables/${parsed.name}`
                });
                res.end(JSON.stringify({ 
                    status: "ok",
                    code: 201,
                    message: "Table created successfully",
                    table: parsed.name
                }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 400,
                    message: err.message || "Invalid JSON or schema"
                }));
            }
        });
        return;
    }

    // GET /tables/{name} - Get table schema
    const tableSchemaMatch = pathname.match(/^\/tables\/([^\/]+)$/);
    if(tableSchemaMatch && req.method === "GET"){
        const tableName = tableSchemaMatch[1];
        try {
            const table = new Table(tableName);
            const schema = await table.getTableSchema(tableName);
            
            if(!schema){
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 404,
                    message: `Table '${tableName}' not found`
                }));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                code: 200,
                message: "Retrieved table schema successfully",
                data: schema
            }));
        } catch (err) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "error",
                code: 404,
                message: `Table '${tableSchemaMatch[1]}' not found`
            }));
        }
        return;
    }

    // DELETE /tables/{name} - Delete table
    if(tableSchemaMatch && req.method === "DELETE"){
        const tableName = tableSchemaMatch[1];
        try {
            if(!Indexer.findTable(tableName)){
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 404,
                    message: `Table '${tableName}' not found`
                }));
                return;
            }

            await Table.delete(tableName);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "ok",
                code: 200,
                message: "Table deleted successfully",
                table: tableName
            }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "error",
                code: 500,
                message: "Internal server error while deleting table"
            }));
        }
        return;
    }

    // GET /tables/{name}/rows - Get all rows
    const getRowsMatch = pathname.match(/^\/tables\/([^\/]+)\/rows$/);
    if(getRowsMatch && req.method === "GET"){
        const tableName = getRowsMatch[1];
        try {
            if(!Indexer.findTable(tableName)){
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 404,
                    message: `Table '${tableName}' not found`
                }));
                return;
            }

            const tableOrm = new TableORM(tableName);
            await tableOrm.init();
            const rows = await tableOrm.readAll();

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "ok",
                code: 200,
                message: `Retrieved ${rows.length} rows from table '${tableName}'`,
                count: rows.length,
                data: rows
            }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "error",
                code: 500,
                message: "Internal server error while retrieving rows"
            }));
        }
        return;
    }

    // POST /tables/{name}/rows - Create row
    const createRowMatch = pathname.match(/^\/tables\/([^\/]+)\/rows$/);
    if(createRowMatch && req.method === "POST"){
        const tableName = createRowMatch[1];
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const parsed = JSON.parse(body);
                const tableOrm = new TableORM(tableName);
                await tableOrm.init();
                const rowId = await tableOrm.create(parsed);

                res.writeHead(201, { 
                    "Content-Type": "application/json",
                    "Location": `/tables/${tableName}/rows/${rowId}`
                });
                res.end(JSON.stringify({ 
                    status: "ok",
                    code: 201,
                    message: "Row created successfully",
                    id: rowId
                }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 400,
                    message: err.message || "Invalid row data"
                }));
            }
        });
        return;
    }

    // GET /tables/{name}/rows/{id} - Get row
    const getRowMatch = pathname.match(/^\/tables\/([^\/]+)\/rows\/([^\/]+)$/);
    if(getRowMatch && req.method === "GET"){
        const [, tableName, rowId] = getRowMatch;
        try {
            const tableOrm = new TableORM(tableName);
            await tableOrm.init();
            const row = await tableOrm.read(rowId);

            if(!row){
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 404,
                    message: `Row '${rowId}' not found in table '${tableName}'`
                }));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                code: 200,
                message: "Retrieved row successfully",
                id: rowId,
                data: row
            }));
        } catch (err) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "error",
                code: 404,
                message: `Row not found or table not found`
            }));
        }
        return;
    }

    // PUT /tables/{name}/rows/{id} - Update row
    if(getRowMatch && req.method === "PUT"){
        const [, tableName, rowId] = getRowMatch;
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const parsed = JSON.parse(body);
                const tableOrm = new TableORM(tableName);
                await tableOrm.init();
                const success = await tableOrm.update(rowId, parsed);

                if(!success){
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ 
                        status: "error",
                        code: 404,
                        message: `Row '${rowId}' not found in table '${tableName}'`
                    }));
                    return;
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "ok",
                    code: 200,
                    message: "Row updated successfully",
                    id: rowId
                }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 400,
                    message: err.message || "Invalid row data"
                }));
            }
        });
        return;
    }

    // DELETE /tables/{name}/rows/{id} - Delete row
    if(getRowMatch && req.method === "DELETE"){
        const [, tableName, rowId] = getRowMatch;
        try {
            const tableOrm = new TableORM(tableName);
            await tableOrm.init();
            const success = await tableOrm.delete(rowId);

            if(!success){
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    status: "error",
                    code: 404,
                    message: `Row '${rowId}' not found in table '${tableName}'`
                }));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "ok",
                code: 200,
                message: "Row deleted successfully",
                id: rowId
            }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                status: "error",
                code: 500,
                message: "Internal server error while deleting row"
            }));
        }
        return;
    }

    // 404 - Not Found
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        status: "error",
        code: 404,
        message: "Endpoint not found"
    }));
});

server.listen(3000,() => {
    console.log("Server is running on http://localhost:3000");

    console.info(chalk.yellowBright("Initializing indexer..."));

    Indexer.init();
    console.info("Indexer initialized!")
});





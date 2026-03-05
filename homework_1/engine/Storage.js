import Indexer from "./Indexer.js";
import fs from "fs";
import path from "node:path";
import Validator from "./Validator.js";
import { dir } from "node:console";

export  class Table {

    #name
    #schema

    constructor(name,schema){
        this.#name = name;
        this.#schema = schema;
    }

    async init() {

        if (this.#schema === undefined) {
            this.#schema = await this.getTableSchema(this.#name);
        }

        if (!Validator.validateSchema(this.#schema)) {
            throw new Error("Invalid schema!");
        }

        await this.#createTableDirector(this.#name);
        await this.#createSchemaFile(this.#name, this.#schema);

    }

    static async create(schema){
        const name = schema.name;

        if(Indexer.findTable(name)){
            return null; // Table already exists
        }

        const table = new Table(name, schema);
        await table.init();
        
        // Add to indexer
        Indexer.addTable(name);

        return table;
    }

    static async delete(name){
        const dirPath = path.join(Indexer.dataDirectoryPath, name);

        try {
            await fs.promises.rm(dirPath, { recursive: true });
            // Remove from indexer
            Indexer.removeTable(name);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async #createTableDirector(name) {
        const dirPath = path.join(Indexer.dataDirectoryPath, name);
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
        } catch (error) {
            console.error(error);
        }
    }

    async #createSchemaFile(name, schema) {
        const filePath = path.join(path.join(Indexer.dataDirectoryPath, name), "schema.json");
        try {
            const content = JSON.stringify(schema);
            await fs.promises.writeFile(filePath, content, "utf8");
        } catch (error) {
            console.error(error);
        }
    }

    async getTableSchema(name) {
        if (name.trim() === "") {
            console.log("Table name should be non empty!");
            return;
        }

        try {
            const filePath = path.join(Indexer.dataDirectoryPath, name, "schema.json");
            const file = await fs.promises.readFile(filePath, "utf8");
            return JSON.parse(file);
        } catch (error) {
            console.error(error);
        }
    }

    

    delete() {}
    update() {}

    getName() {
        return this.#name;
    }

    getSchema() {
        return this.#schema;
    }
}

export class TableORM {

    #table
    #schema
    #tableDir

    constructor(tableName) {
        const table = new Table(tableName);
        this.#table = table;
        this.#schema = table.getSchema();
        this.#tableDir = path.join(Indexer.dataDirectoryPath, tableName);
    }

    async init() {
        if (!this.#schema) {
            await this.#table.init();
            this.#schema = this.#table.getSchema();
        }
    }

    async create(row) {
        if (!Validator.validateObj(row, this.#schema)) {
            throw new Error("Validation failed");
        }

        try {            
            const rowId = crypto.randomUUID();
            const filePath = path.join(this.#tableDir, `${rowId}.json`);
            const content = JSON.stringify(row);

            await fs.promises.writeFile(filePath, content, "utf8");
            
            return rowId;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async read(id) {
        if (typeof(id) !== "string" || id.trim() === "") {
            throw new Error("Invalid id");
        }

        try {            
            const filePath = path.join(this.#tableDir, `${id}.json`);
            
            if (!await this.#fileExists(filePath)) {
                return null;
            }

            const content = await fs.promises.readFile(filePath, "utf8");
            return JSON.parse(content);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async readAll() {
        try {
            const files = await fs.promises.readdir(this.#tableDir);
            const rows = [];

            for (const file of files) {
                // Skip schema.json and non-json files
                if (file === "schema.json" || !file.endsWith(".json")) {
                    continue;
                }

                const filePath = path.join(this.#tableDir, file);
                const content = await fs.promises.readFile(filePath, "utf8");
                const id = file.replace(".json", "");
                
                rows.push({
                    id: id,
                    data: JSON.parse(content)
                });
            }

            return rows;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async update(id, newRow) {
        if (typeof(id) !== "string" || id.trim() === "") {
            throw new Error("Invalid id");
        }

        if (!Validator.validateObj(newRow, this.#schema)) {
            throw new Error("Validation failed");
        }

        try {            
            const filePath = path.join(this.#tableDir, `${id}.json`);
            
            if (!await this.#fileExists(filePath)) {
                return false;
            }

            const content = JSON.stringify(newRow);
            await fs.promises.writeFile(filePath, content, "utf8");
            
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async #fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async delete(id) {
        if (typeof(id) !== "string" || id.trim() === "") {
            throw new Error("Invalid id");
        }

        try {            
            const filePath = path.join(this.#tableDir, `${id}.json`);

            if (!await this.#fileExists(filePath)) {
                return false;
            }

            await fs.promises.rm(filePath);
            
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}
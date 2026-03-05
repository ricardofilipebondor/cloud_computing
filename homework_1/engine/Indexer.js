import path from 'node:path';
import fs from "fs";

class Indexer{

    dataDirectoryPath;
    #tables = new Map(); // Map to store table names

    constructor(){
        const currentDir = process.cwd(); 
        const dataDir = path.join(currentDir, 'data');
        this.dataDirectoryPath = dataDir; 
    }

    async init() {
        try {
            // Clear existing tables
            this.#tables.clear();
            
            const dirList = await this.getListFromDataDirectory();

            for(const dir of dirList){
                const dirPath = path.join(this.dataDirectoryPath, dir);
                const isDirectory = (await fs.promises.stat(dirPath)).isDirectory();
                
                if(isDirectory){
                    // Add table to index
                    this.#tables.set(dir, dirPath);
                }
            }
            
            console.info(`Indexed ${this.#tables.size} tables`);
        } catch (err) {
            console.error('Error initializing indexer:', err);
        }
    }

    async getListFromDataDirectory() {
        try {
            return await fs.promises.readdir(this.dataDirectoryPath);
        } catch (err) {
            console.error('Error reading data directory:', err);
            return [];
        }
    }

    // Get all tables
    getTables(){
        const result = {};
        for (const [name, path] of this.#tables) {
            result[name] = { path };
        }
        return result;
    }

    // Check if table exists
    findTable(name) {
        if(!name || typeof(name) !== "string" || name.trim() === "") {
            return false;
        }
        return this.#tables.has(name);
    }

    // Add a new table to index
    addTable(name){
        if(!name || typeof(name) !== "string" || name.trim() === "") {
            console.error("Table name should be non-empty string!");
            return false;
        }
        
        const dirPath = path.join(this.dataDirectoryPath, name);
        this.#tables.set(name, dirPath);
        console.info(`Table '${name}' added to index`);
        return true;
    }

    // Remove table from index
    removeTable(name){
        if(!name || typeof(name) !== "string" || name.trim() === "") {
            console.error("Table name should be non-empty string!");
            return false;
        }
        
        const removed = this.#tables.delete(name);
        if(removed) {
            console.info(`Table '${name}' removed from index`);
        }
        return removed;
    }

    // Legacy: getIndexes() - returns tables in old format
    getIndexes(){
        return this.getTables();
    }
}

export default new Indexer
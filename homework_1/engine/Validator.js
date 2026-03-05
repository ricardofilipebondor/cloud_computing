class Validator{
    constructor(){

    }

    validateSchema(schema){
        if(typeof(schema) !== "object"){
            console.error("Schema should be an json object!");
            return false;
        } 

        for(const key of ["name","columns"]){
            if(!schema.hasOwnProperty(key)){
                console.error("Schema should contain " + key);
                return false;
            }
        }

        if(!Array.isArray(schema["columns"])){
            console.error("Property columns should be an array!");
            return false;
        }

        for (const column of schema.columns) {
            if (!this.validateColumn(column)) {
                return false; 
            }
        }
        return true;
    }

    validateColumn(column){
        if(typeof(column) !== "object"){
            console.error("Column should be a json object!");
            return false;
        } 

        for(const key of ["name","type"]){
            if(!column.hasOwnProperty(key)){
                console.error("Schema should contain " + key);
                return false;
            }

            
            if(key === "name" && typeof(column[key]) !== "string"){
                console.error("Column name should be a string!");
                return false;
            }
            
            if(key === "type"){
                if(typeof(column[key]) !== "string"){
                    console.error("Column name should be a string!");
                    return false;
                }

                if(!["string","boolean","number"].includes(column[key])){
                    console.error("Column type: " + column[key] + " not allowed!");
                    return false;
                }

            }   
            
        }

        // Check if column name is "id" - not allowed because rows already have auto-generated IDs
        if(column.name === "id"){
            console.error("Column name 'id' is reserved! Rows already have auto-generated IDs.");
            return false;
        }

        return true;
    }

    // {name:"id",
    // columns:[
    //     {name:"id",type:"number"},
    //     {name:"name",type:"string"}
    // ]}

    // {id:1,name:"Jhon"}

    validateObj(body,schema){

        if(typeof(body) !== "object"){
            console.error("Body should be a json object!");
            return false;
        }

        const columns = schema.columns;
        const bodyKeys = Object.keys(body);

        if(bodyKeys.length === 0){
            console.error("Body cannot be empty!");
            return false;
        }

        // Check that we have exactly the same number of columns
        if(bodyKeys.length !== columns.length){
            console.error(`Body must contain exactly ${columns.length} columns, but got ${bodyKeys.length}`);
            return false;
        }

        // Check each key in body
        for(const key of bodyKeys){
            const column = columns.find(column => column.name === key);
            if(!column){
                console.error(`Column '${key}' not defined in schema!`);
                return false;
            }

            if(typeof(body[key]) !== column.type){
                console.error("Type mismatch for column '" + key + "': expected " + column.type + " but got " + typeof(body[key]));
                return false;
            }
        }

        // Check that all schema columns are present in body
        for(const column of columns){
            if(!bodyKeys.includes(column.name)){
                console.error(`Missing required column '${column.name}' in data!`);
                return false;
            }
        }

        return true;
    }

}

export default new Validator;
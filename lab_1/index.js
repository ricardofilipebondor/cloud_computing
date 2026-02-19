require('dotenv').config();

const apy_key = process.env.API_KEY;

async function getData() {
    try{

        const url = 'https://www.virustotal.com/api/v3/popular_threat_categories';
        const headers =  {
            headers: {
                'x-apikey': apy_key
            }
        };

        const response = await fetch(url, headers);

        const data = await response.json();
        console.log(data);
        
    }catch(error){
        console.error('Error fetching data:', error);
    }
}

getData();
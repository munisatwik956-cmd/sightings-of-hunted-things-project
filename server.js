import http, { get } from 'node:http'
import path from 'node:path'
import fs from 'node:fs/promises'
import sanitizeHtml from 'sanitize-html'
import EventEmitter from 'node:events'


const sightingEvents = new EventEmitter()
sightingEvents.on('sighting-added', createAlert)


function sendResponce(res,statusCode,contentType,payload){

    res.statusCode=statusCode
    res.setHeader('Content-Type',contentType)
    res.end(payload)

}

function getContentType(ext){
    const types={
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".png": "image/png",
        ".jpg": "image/jpg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml"    
    }

    return types[ext.toLowerCase()] || "text/html"
}

async function getData(){
    try{
        const data = await fs.readFile(path.join(__dirname,'public','data','data.json'),'utf-8')

        const parsedData=JSON.parse(data)

        return parsedData
    }catch(err){

        console.log(err)
        return []

    }
}

async function handleGet(res){
    const data = await getData()
    const content = JSON.stringify(data)
    sendResponce(res,200,'application/json',content)
}

async function parseJSONBody(req){
    let body = ''
    for await (let chunk of req){
        body += chunk
    }
    try{
        return JSON.parse(body)
    }catch(err){
        throw new Error(`Invalid JSON format : ${err}`)
    }
}

async function handlePost(req,res){

    try{

        const parsedBody = await parseJSONBody(req)

        const sanitizedBody = sanitizeInput(parsedBody)

        await addNewSighting(sanitizedBody)

        sightingEvents.emit('sighting-added',sanitizedBody)

        sendResponce(res,201,'application/json',JSON.stringify(sanitizedBody))

        console.log("POST request recived")

    }catch(err){

        sendResponce(res,400,'application/json',JSON.stringify({error: err}))
        
    }

}

async function addNewSighting(newSighting){

    try{

        const sightings=await getData()
        sightings.push(newSighting)

        const pathJSON = path.join(__dirname,'public','data','data.json')

        await fs.writeFile(pathJSON,JSON.stringify(sightings,null,2),'utf-8')

    }catch(err){
        
        throw new Error(err)

    }

}


function sanitizeInput(data){
    
    const sanitizedData={}

    for(const [key,value] of Object.entries(data)){
        if(typeof value === 'string'){
            sanitizedData[key]=sanitizeHtml(value,{allowedTags:[],allowedAttributes:{}})
        }else{
            sanitizedData[key]=value
        }
    }

    return sanitizedData

}

function createAlert(sighting){
    alert(`Alert message is sent to Gost Hunters in ${sighting.location}`)
}




const PORT=8000 
const __dirname=import.meta.dirname
const __filename=import.meta.filename


const server= http.createServer(async (req,res)=>{    
    if(req.url.startsWith('/api')){
        if(req.method === 'GET'){
            return await handleGet(res)
        }else if(req.method === 'POST'){
            await handlePost(req,res)
        }

    }else if(!req.url.startsWith('/api')){
        try{
            const publicDir=path.join(__dirname,'public')
            const pathToResource=path.join(publicDir,req.url === '/' ? "index.html" : req.url)


            const ext = path.extname(pathToResource)
            const content = await fs.readFile(pathToResource)

            
            sendResponce(res,200,getContentType(ext),content)


        }catch(err){
            if(err.code === 'ENOENT'){
                const publicDir=path.join(__dirname,'public')
                const pathToResource=path.join(publicDir,'404.html')

                const content=await fs.readFile(pathToResource)

                sendResponce(res,404,'text/html',content)
            }else{
                sendResponce(res,500,'text/html',`<html><h1>Server Error: ${err.code}</h1></html>`)
            }
        }
    }


})


server.listen(PORT,()=>{
    console.log(`Connected to port : ${PORT}`)
})

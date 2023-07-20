#!/usr/bin/env node

import figlet from "figlet";
import inquirer from "inquirer";
import chalk from "chalk";
import { createSpinner } from "nanospinner";
import {exec} from "child_process"
import fs from 'fs';

let mode;
let curMAC;
let newMAC;
let interfaces;
let userInterface;
let macVendors;

const pattern = /[a-f0-9][a-f0-9]:[a-f0-9][a-f0-9]:[a-f0-9][a-f0-9]:[a-f0-9][a-f0-9]:[a-f0-9][a-f0-9]:[a-f0-9][a-f0-9]/

async function delay(int){
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, int);
    })
}

async function welcome(){
    figlet('Fake MAC',(err,data) => {
        console.log(chalk.cyan(data));
    });
    await new Promise(resolve => {
        fs.readFile('./mac-vendors.json',(err,data) => {
            if(err){
                console.log(chalk.red(err));
                process.exit(1);
            }
            macVendors = JSON.parse(data.toString()).map(val => val['macPrefix'].toLowerCase());
            resolve();
        });
    });
}

async function getInterfaces(){
    return new Promise(resolve => {
        exec('basename -a /sys/class/net/*',(err,stdout,stderr) => {
            if(err){
                console.log(chalk.red(err));
                process.exit(1);
            }
            resolve(stdout.split('\n').filter(val => val && val != 'lo'));
        })
    });
}

async function getUserInterface(){
    const input = await inquirer.prompt({
        name:'Interface',
        type:'list',
        message:'What is the interface you want to change it\'s MAC address?',
        choices:interfaces
    });
    userInterface = input.Interface;
}

async function getUserMode(){
    const input = await inquirer.prompt({
        name:'Mode',
        type:'list',
        message:'How do want to change the MAC address?',
        choices: ['Randomly','Specify MAC']
    });
    mode = input.Mode;
}

async function getCurrentMAC(){
    return new Promise(resolve => {
        exec(`ip addr show ${userInterface}`,(err,stdout,stderr) => {
            if (err){
                console.log(chalk.red(err));
                process.exit(1);
            }
            curMAC = pattern.exec(stdout)[0].toLowerCase();
            resolve();
        })
    });
}

async function getUserMAC(){
    const input = await inquirer.prompt({
        name:'MAC',
        type:'input',
        message:'Enter the MAC address:',
        default:curMAC,
        validate:data => {
            const isvalid = pattern.test(data.toLowerCase()) && pattern.exec(data.toLowerCase())[0] == pattern.exec(data.toLowerCase())['input'];
            if(!isvalid)
                console.log(chalk.red('\nInvalid MAC address!'));
            let found = false;
            for(let i = 0; i < macVendors.length; i++){
                if (macVendors[i] === data.toLowerCase().substr(0,macVendors[i].length)){
                    found = true;
                    break;
                }
            }
            if(!found)
                console.log(chalk.red('\nInvalid MAC address!'));
            return isvalid && found;
        }
    });
    newMAC = input.MAC;
}

async function generateMAC(){
    return new Promise(resolve => {
        let MAC = macVendors[Math.floor(Math.random() * macVendors.length)] + ':';
        console.log(MAC);
        const hostIdLen = 5 - (MAC.split(':').length - 1) + 1;
        const hex = '0123456789abcdef';
        for(let i = 0;i < hostIdLen * 2;i++){
            if(i%2 && i != (hostIdLen * 2) - 1)
                MAC += hex.charAt(Math.floor(Math.random() * hex.length)) + ':';
            else
                MAC += hex.charAt(Math.floor(Math.random() * hex.length));
        }
        resolve(MAC);
    });
    
}

async function changeMAC(){
    const spinner = createSpinner('Changing MAC address...').start();
    await delay(1000);
    await new Promise(resolve => {
        exec(`ip link set dev ${userInterface} down; ip link set dev ${userInterface} address ${newMAC}; ip link set dev ${userInterface} up`,(err,stdout,stderr) =>{
            if(err){
                spinner.error({text:chalk.red(err)});
                process.exit(1);     
            }
            spinner.success({text:'MAC address changed successfully!'});
            resolve();
        })
    });
}

await welcome();
interfaces = await getInterfaces();
await getUserInterface();
await getUserMode();
if (mode === 'Randomly')
    newMAC = await generateMAC();
else{
    await getCurrentMAC();
    await getUserMAC();
}
await changeMAC();



const crypto = require('crypto');
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const jsonwebtoken = require('jsonwebtoken');
var connection  = require('./lib/database');
//var mysql = require('mysql');
require('dotenv').config();

var cookie = {}
const app = express();
app.use(cookieParser());
app.set("view engine","ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/images'));

app.get("/",(req,res) => {

    if(!(req.cookies['login'] in cookie)){
        res.redirect("/login");
        return;
    }

    connection.query("SELECT `isadmin` FROM `users` WHERE `userid`="+cookie[req.cookies['login']]["id"],function(err,result){
        
        staffs_ = [],halls_ = [];
    
        if(result[0].isadmin == 1){ 
            connection.query("SELECT * FROM `users` WHERE `isadmin`=0",function(err,staffs_){
            connection.query("SELECT * FROM `halls`",function(err,halls_){
            connection.query("SELECT * FROM `examduty`",function(err,result){
                res.render("admin",{username:cookie[req.cookies['login']]["username"],staffs:staffs_,halls:halls_,exams:result});
            });
            });
            });
            return;
        }
        
        connection.query("SELECT `datetime` FROM `biometric` WHERE `staff_id`="+cookie[req.cookies['login']]["id"],function(err,result){
            bioMA = [0,0];
            bioKep = [0,0]
            for(let res = 0;res<result.length;res++){
                keptAt = new Date(result[res]["datetime"])
                morningStart = new Date();morningStart.setHours(7,30);
                morningEnd = new Date();morningEnd.setHours(8,45);
                AfternoonStart = new Date();AfternoonStart.setHours(12,15);
                AfternoonEnd = new Date();AfternoonEnd.setHours(13,30);

                if( keptAt > morningStart && keptAt < morningEnd ){ bioMA[0] = 1;bioKep[0] = keptAt.toString().slice(15,24); }
                else if( keptAt > AfternoonStart && keptAt < AfternoonEnd ){ bioMA[1] = 1;bioKep[1] = keptAt.toString().slice(15,24); }
            }

            connection.query("SELECT * FROM `examduty`",function(err,allExamDuty){
            connection.query("SELECT * FROM `examduty` where  JSON_CONTAINS(examduty.staffs, '\""+cookie[req.cookies['login']]["id"]+"\"','$.staffs');",function(err,exams_){
            connection.query("SELECT * FROM `allotment` WHERE `staff_id`="+cookie[req.cookies['login']]["id"],function(err,result){
                res.render("user",{userid:cookie[req.cookies['login']]["id"],username:cookie[req.cookies['login']]["name"],biometric:bioMA,keptAt:bioKep,exams:exams_,allExams:allExamDuty,allotments:result});
            });
            });
            });
        });

    });
}); 

app.post("/",(req,res) => {
    if("logout" in req.body){
        delete cookie[req.socket.remoteAddress];
        res.redirect("/login");
        return;
    }

    if("createExamDuty" in req.body){
        req.body["staffs[]"] = {"staffs":req.body["staffs[]"]};
        connection.query(
            "INSERT INTO `examduty`(`exam_id`,`exam_title`,`exam_date`,`exam_time`,`staffs`,`halls`) VALUES ("+req.body["id"]+",'"+req.body["title"]+"','"+req.body["datetime"]+"',"+req.body["examtime"]+",'"+JSON.stringify( req.body["staffs[]"] )+"','"+req.body["halls[]"]+"')", 
            function (err, result) {if (err){throw err;}}
        );
        res.redirect("/");
    }
}); 

app.get("/biometric",(req,res) => {
    connection.query("SELECT `userid`,`username` FROM `users` WHERE `isadmin`=0", function (err, result, fields) {
        if (err) throw err;
        res.render("biometric",{staffs:result});
    });
});

app.post("/biometric",(req,res) => {
    let date = new Date();
    if("biometricMorning" in req.body){
        date.setHours(8,15);
    }else if("biometricAfternoon" in req.body){
        date.setHours(13,10);
    }
    
    connection.query(
        "INSERT INTO `biometric`(`staff_id`, `datetime`) VALUES ('"+req.body.staff+"','"+date.toISOString()+"')", 
        function (err, result) {if (err){throw err;}}
    );

    connection.query(
        "SELECT * FROM `examduty` where  JSON_CONTAINS(examduty.staffs, '\""+req.body.staff+"\"','$.staffs');", 
        function (err, result) {
            if (err){throw err;}
            let exams = result;
            let userid = req.body.staff; 
            let staffs = [];let userindutyFlag = 0;
            morningStart = new Date();morningStart.setHours(7,30);
            morningEnd = new Date();morningEnd.setHours(8,45);
            AfternoonStart = new Date();AfternoonStart.setHours(12,15);
            AfternoonEnd = new Date();AfternoonEnd.setHours(13,30);

            for(var i = 0; i < exams.length; i++){
                if( new Date(exams[i]["exam_date"]).getDate() != date.getDate() || new Date(exams[i]["exam_date"]).getMonth() != date.getMonth() )continue;
                
                staffs = JSON.parse(result[i].staffs).staffs;
                if(typeof(staffs) == 'number' || typeof(staffs) == 'string') staffs = [staffs];
                
                var halls = exams[i]["halls"].split(",");var index = -1;
                if(date > morningStart && date < morningEnd){
                    if(exams[i]["exam_time"] == 0){
                        index = Math.floor(Math.random() * halls.length);
                    }else{index = -2;}
                }else if(date > AfternoonStart && date < AfternoonEnd){
                    if(exams[i]["exam_time"] == 1){
                        index = Math.floor(Math.random() * halls.length);
                    }else{index = -2;}
                }else{
                    console.log("Not Kept On Time Error");
                    return;
                }
                
                if(index == -1){
                    console.log("No Halls Available ",halls);
                    return;
                }else if(index == -2){
                    console.log("Wrong Time Exam exam_time:",exams[i]["exam_time"]);
                    return;
                }

                connection.query(
                    "SELECT hall_name from halls where hall_id = "+halls[index],
                    function (err, result){
                        let hall_name = result[0]["hall_name"];
                        connection.query(
                            "INSERT INTO `allotment`(`staff_id`, `hall_name`, `exam_id`) VALUES ('"+req.body.staff+"','"+hall_name+"','"+exams[i]["exam_id"]+"')", 
                            function (err, result) {
                                if (err){throw err;}
                                
                                staffs.splice(staffs.indexOf(req.body.staff.toString()),1);
                                halls.splice(index,1);
                                
                                staffs = {"staffs":staffs};
                                connection.query("UPDATE `examduty` SET staffs = '"+JSON.stringify(staffs)+"', halls = '"+halls+"' WHERE exam_id = "+exams[i]["exam_id"],function(err,result){});
                            }
                        );
                    }
                );
                
                return;
                
            }
        }
    );
    
    res.redirect("/");
});

app.get("/login",(req,res) => {
    res.render("login",{client_id:process.env.CLIENT_ID})
});

app.post("/login",(req,res) => {
    let hash = crypto.createHash('md5').update((new Date()).toLocaleString(undefined,{timeZone: 'Asia/Kolkata'})+crypto.randomInt(1000)+"x"+crypto.randomInt(1000)).digest('hex');

    let user = jsonwebtoken.decode(req.body["credential"]);
    connection.query("SELECT *, MAX(`userid`) AS `last_id` FROM `users` WHERE `mail`='"+user['email']+"'",(err, result, fields) => { 
        if (err) throw err;

        let isadmin = 0;let _id = 0;
        if(result.length < 1 || result[0].userid == null){
            _id = result[0].last_id + 1;
            connection.query("INSERT INTO `users`(`username`, `mail`, `isadmin`) VALUES ('"+user['name']+"','"+user['email']+"',0)", (err, result, fields) => { if (err){throw err;} });
        }else{
            isadmin = result[0].isadmin;
            _id = result[0].userid;
        }
        res.cookie('login',hash);
        cookie[hash]={'id':_id,'mail':user['email'],'name':user['name'],'picture':user['picture'],'isadmin':isadmin};
        res.redirect("../");
    });
});

app.listen(process.env.PORT, 'localhost', function() {
    console.log('Listening to port:  ' + process.env.PORT);
});
'use strict';
// Same boot-relative clock in every process. Windows Date.now() can be
// independently resynchronised by V8; it is unsuitable for shared leases.
const os=require('node:os');
const BASIS='system-uptime-ms-v1';
function now(){return Math.floor(os.uptime()*1000)}
module.exports={now,BASIS};

#!/usr/bin/env node
/**
 * Automated Health & 24h Performance Report Runner
 * Can be triggered via Cron, CLI, or Systemd Timer
 */
const path = require('path');
const { sendReportEmail, collectSystemHealth, generateReportHtml } = require(path.join(__dirname, '../backend/healthReporter.js'));

const args = process.argv.slice(2);

if (args.includes('--send')) {
    const toIdx = args.indexOf('--to');
    const customTo = toIdx !== -1 && args[toIdx + 1] ? args[toIdx + 1] : null;
    sendReportEmail({ recipient: customTo, trigger: 'cron' }).then(res => {
        if (res.success) {
            console.log(`[${new Date().toISOString()}] Report successfully sent to ${res.recipient} (Status: ${res.overallStatus})`);
            process.exit(0);
        } else {
            console.error(`[${new Date().toISOString()}] Report failed: ${res.error}`);
            process.exit(1);
        }
    }).catch(err => {
        console.error(`[${new Date().toISOString()}] Fatal error: ${err.message}`);
        process.exit(1);
    });
} else if (args.includes('--preview')) {
    collectSystemHealth().then(data => {
        console.log(generateReportHtml(data));
        process.exit(0);
    });
} else if (args.includes('--json')) {
    collectSystemHealth().then(data => {
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    });
} else {
    console.log(`
Usage:
  node health_report.js --send [--to email@example.com]   Compile and send email report
  node health_report.js --preview                         Output HTML email
  node health_report.js --json                            Output raw JSON metrics
    `);
    process.exit(0);
}

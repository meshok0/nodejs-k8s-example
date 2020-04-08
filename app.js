const ns = process.env.NAMESPACE || 'default';

const util = require('util')
const k8s = require('@kubernetes/client-node');
const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // if running locally (requires kubeconfig setted up)
//kc.loadFromCluster(); // if running in k8s cluster
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const job = {
        metadata: {
          name: "example-job"
        },
        spec: {
          template: {
            spec: {
              containers: [
                {

                  name: "worker",
                  image: "busybox",
                  imagePullPolicy: "IfNotPresent",
                  command: [
                    "/bin/sh",
                    "-c",
                    "echo Started; sleep 10; echo Finished"
                  ]
                }
              ],
              restartPolicy: "Never"
            }
          }
        }
    }

    while (true) {
        console.log(new Date().toISOString() + ' Creating Job: ' + job.metadata.name);
        try {
            let job_promise = await k8sBatchApi.createNamespacedJob(ns, job);
            console.log(new Date().toISOString() + ' Created Job: ' + job_promise.body.metadata.name);
            break;
        } catch(err) {
            console.log(new Date().toISOString() + ' Error creating job: ' + util.inspect(err.response.body));
            if (err.response.body.reason == 'AlreadyExists') {
                console.log(new Date().toISOString() + ' Deleting Job: ' + job.metadata.name);
                try {
                    await k8sBatchApi.deleteNamespacedJob(job.metadata.name, ns, undefined, undefined, undefined, undefined, "Foreground");
                    console.log(new Date().toISOString() + ' Deleted Job: ' + job.metadata.name);
                } catch(err) {
                    console.log(new Date().toISOString() + ' Deletion error: ' + util.inspect(err.response.body));
                    return;
                };
            };
        };
    };

    while (true) {
        try {
            console.log(new Date().toISOString() + ' Reading Job status: ' + job.metadata.name);
            let job_promise = await k8sBatchApi.readNamespacedJob(job.metadata.name, ns);
            if (job_promise.body.status.succeeded) {
                console.log(new Date().toISOString() + ' Job succeeded: ' + job.metadata.name);
                break;
            } else if (job_promise.body.status.failed) {
                console.log(new Date().toISOString() + ' Job failed: ' + job.metadata.name);
                break;
            }
        } catch(err) {
            console.log(new Date().toISOString() + ' Reading job status error: ' + util.inspect(err.response.body));
        }
        await sleep(2000);
    };

    console.log(new Date().toISOString() + ' Deleting Job: ' + job.metadata.name);
    try {
        await k8sBatchApi.deleteNamespacedJob(job.metadata.name, ns, undefined, undefined, undefined, undefined, "Foreground");
        console.log(new Date().toISOString() + ' Deleted Job: ' + job.metadata.name);
    } catch(err) {
        console.log(new Date().toISOString() + ' Deletion error: ' + util.inspect(err.response.body));
    }

})();

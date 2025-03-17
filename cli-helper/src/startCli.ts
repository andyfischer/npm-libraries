import { closeStdinListener } from './readInput';
import '../submodules/subproject-setup/createSubproject';

async function main() {
    console.log('unimplemented');
    // await replLoop();

    closeStdinListener();
    //process.kill(process.pid, "SIGINT");
    //console.log('Exiting');
    console.log('Done');
}

main().catch(err => {
    process.exitCode = -1;
    console.error(err);
});
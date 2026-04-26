import { runMileageDraftTests } from "./mileageDraft.test";
import { runHashRoutingTests } from "./hashRouting.test";

runMileageDraftTests();
runHashRoutingTests();

console.log("Regression tests passed: mileage draft + hash routing");

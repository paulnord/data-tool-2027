import { z } from "zod/v4";
import { writeFileSync } from "node:fs";
import { build } from "esbuild";
const bundled = await build({stdin: {contents: 'export * from "./src/core/fit/schema.ts"; export * from "./tests/support/synthetic.ts";', resolveDir: process.cwd()}, bundle: true, platform: "node", format: "esm", write: false});
const { requestSchema, sessionSchema, sessionV1Schema, sessionV2Schema, sessionV3Schema, acknowledgmentSchema, initialSettings, syntheticRequest, gaussianGenerator } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
for (const [name, schema, version] of [
  ["request", requestSchema, 1],
  ["session", sessionV1Schema, 1],
  ["session", sessionV2Schema, 2],
  ["session", sessionV3Schema, 3],
  ["ack", acknowledgmentSchema, 1],
]) {
  const json = z.toJSONSchema(schema, { target: "draft-7" });
  json.title = `Tracker fit ${name} v${version}`;
  json.$comment =
    "Structural schema. Also apply semantic rules in schemas/README.md: unique identities, row associations, missing-value consistency, model parameter count and assumption consistency.";
  writeFileSync(
    `schemas/tracker-fit-${name}.v${version}.json`,
    JSON.stringify(json, null, 2) + "\n",
  );
}
if (process.argv.includes("--schemas-only")) process.exit(0);
const request = syntheticRequest();
writeFileSync(
  "examples/fit/synthetic-request.json",
  JSON.stringify(request, null, 2) + "\n",
);
writeFileSync(
  "examples/fit/synthetic-session.trksess",
  JSON.stringify(
    sessionSchema.parse({
      format: "tracker-fit-session",
      version: 1,
      request,
      settings: { ...initialSettings(), physicalTimeConfirmed: true },
      engine: "qr-mgs2-1",
    }),
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "examples/fit/accepted-ack.json",
  JSON.stringify(
    {
      format: "tracker-fit-ack",
      version: 1,
      requestId: request.requestId,
      status: "accepted",
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "examples/fit/invalid-extra-field.json",
  JSON.stringify({ ...request, scaleFactor: 0.1 }, null, 2) + "\n",
);
writeFileSync(
  "examples/fit/invalid-row-association.json",
  JSON.stringify(
    {
      ...request,
      uncertainty: {
        kind: "supplied-per-row",
        errorStructure: "uncorrelated",
        provenance: {
          kind: "user-asserted",
          description: "Intentionally invalid fixture",
        },
        sigmaByRow: {},
      },
    },
    null,
    2,
  ) + "\n",
);

// Demonstration sessions: equations here are independent of the fitter's basis.

const demos = [
  { model: "cubic", formula: "y=1-2x+0.5x^2+x^3", x: i => -2+4*i/80, y: x => 1-2*x+0.5*x*x+x**3 },
  { model: "quartic", formula: "y=1-2x^2+0.5x^4", x: i => -2+4*i/80, y: x => 1-2*x*x+0.5*x**4 },
  { model: "logarithmic", formula: "y=1.5+2*ln(x/1)", x: i => 0.2+7.8*i/80, y: x => 1.5+2*Math.log(x) },
  { model: "sine", formula: "y=1+2*sin(2*pi*x/3)+0.75*cos(2*pi*x/3); supplied period=3 s", x: i => 9*i/80, y: x => 1+2*Math.sin(2*Math.PI*x/3)+0.75*Math.cos(2*Math.PI*x/3) },
];
for (const [index, demo] of demos.entries()) {
  const noise = gaussianGenerator(3000+index);
  const request = syntheticRequest();
  request.requestId = `e7c00000-0000-4000-8000-${String(100+2*index).padStart(12,"0")}`;
  request.snapshotId = `e7c00000-0000-4000-8000-${String(101+2*index).padStart(12,"0")}`;
  request.dataset.id = demo.model + "-demo";
  request.dataset.label = demo.model + " · synthetic experiment";
  request.dataset.xColumn = { id: "x", label: demo.model === "sine" ? "Time" : "x", unit: demo.model === "sine" ? "s" : null };
  request.dataset.yColumn = { id: "y", label: "Signal", unit: "m" };
  request.source.context = `seed=${3000+index}; ${demo.formula}; independent Gaussian sigma=0.05 m; synthetic, not measured`;
  request.dataset.rows = Array.from({length:81}, (_,i) => {
    const x=demo.x(i);
    return { id:`row-${i}`, x, y:demo.y(x)+0.05*noise(), included:true, missingReason:null };
  });
  request.uncertainty.sigmaY = 0.05;
  const settings = initialSettings(demo.model);
  if (demo.model === "sine") settings.sinePeriod = 3;
  const session = sessionSchema.parse({ format:"tracker-fit-session",version:1,request,settings,engine:"qr-mgs2-1" });
  writeFileSync(`examples/fit/${demo.model}-demo.trksess`, JSON.stringify(session,null,2)+"\n");
}

const freeSine = JSON.parse((await import("node:fs")).readFileSync("examples/fit/sine-demo.trksess", "utf8"));
freeSine.engine = "qr-vp-sine-2";
freeSine.settings = {...initialSettings("sine-free-period"),periodMin:1.5,periodMax:6};
freeSine.settings.parameters[3].value = 2.6;
freeSine.request.dataset.label = "Sine with unknown period · synthetic experiment";
freeSine.request.requestId = "e7c00000-0000-4000-8000-000000000201";
freeSine.request.snapshotId = "e7c00000-0000-4000-8000-000000000202";
writeFileSync("examples/fit/sine-fit-period-demo.trksess", JSON.stringify(sessionSchema.parse(freeSine),null,2)+"\n");
for (const [index,model,shape,formula,fn] of [
  [0,"exponential",-0.7,"y=0.5+3*exp(-0.7*x)",x=>0.5+3*Math.exp(-0.7*x)],
  [1,"power-law",1.5,"y=1+0.8*x^1.5",x=>1+0.8*x**1.5],
  [2,"reciprocal",undefined,"y=1+2/x",x=>1+2/x],
]) {
  const request=syntheticRequest();
  const noise=gaussianGenerator(4000+index);
  request.dataset.label=model+" · synthetic experiment";
  request.dataset.id=model+"-demo";
  request.dataset.xColumn={id:"x",label:"x",unit:null};
  request.dataset.yColumn={id:"y",label:"Signal",unit:"m"};
  request.requestId="e7c00000-0000-4000-8000-"+String(300+2*index).padStart(12,"0");
  request.snapshotId="e7c00000-0000-4000-8000-"+String(301+2*index).padStart(12,"0");
  request.source.context=formula+"; Gaussian sigma=0.05 m; seed="+(4000+index);
  request.uncertainty.sigmaY=0.05;
  request.dataset.rows=Array.from({length:81},(_,i)=>{const x=0.25+4.75*i/80;return {id:"row-"+i,x,y:fn(x)+0.05*noise(),included:true,missingReason:null};});
  const settings={...initialSettings(model),...(shape===undefined?{}:{shape})};
  writeFileSync("examples/fit/"+model+"-demo.trksess",JSON.stringify(sessionSchema.parse({format:"tracker-fit-session",version:1,engine:"qr-vp-sine-2",request,settings}),null,2)+"\n");
}

const barRequest=syntheticRequest();
const barNoise=gaussianGenerator(50272027);
barRequest.requestId='e7c00000-0000-4000-8000-000000000501';
barRequest.snapshotId='e7c00000-0000-4000-8000-000000000502';
barRequest.dataset.id='error-bars-demo';
barRequest.dataset.label='Unequal error bars · synthetic experiment';
barRequest.dataset.xColumn={id:'x',label:'x',unit:'s'};
barRequest.dataset.yColumn={id:'y',label:'Signal',unit:'m'};
barRequest.source.context='y=1+2x; independent Gaussian sigma_i=0.04+0.18x m; seed=50272027';
const sigmaByRow={};
barRequest.dataset.rows=Array.from({length:31},(_,i)=>{
 const x=2*i/30,sigma=.04+.18*x,id='row-'+i;
 sigmaByRow[id]=sigma;
 return {id,x,y:1+2*x+sigma*barNoise(),included:true,missingReason:null};
});
barRequest.uncertainty={kind:'supplied-per-row',errorStructure:'uncorrelated',sigmaByRow,provenance:{kind:'user-asserted',description:'Known generating Gaussian standard deviations, synthetic data'}};
writeFileSync('examples/fit/error-bars-demo.trksess',JSON.stringify(sessionSchema.parse({format:'tracker-fit-session',version:1,engine:'qr-vp-sine-2',request:barRequest,settings:initialSettings('line')}),null,2)+'\n');

// Same observations, two weighting choices; the control is descriptive only.
const unequalRequest=structuredClone(barRequest);
unequalRequest.requestId='e7c00000-0000-4000-8000-000000000601';
unequalRequest.snapshotId='e7c00000-0000-4000-8000-000000000602';
unequalRequest.dataset.id='unequal-weights-comparison';
unequalRequest.dataset.label='Unequal weights · known per-point uncertainty';
unequalRequest.source.context += '; fit weights w_i=1/sigma_i^2 (625 to 6.25 m^-2)';
const unequalSession=sessionSchema.parse({format:'tracker-fit-session',version:1,engine:'qr-vp-sine-2',request:unequalRequest,settings:initialSettings('line')});
writeFileSync('examples/fit/unequal-weights-demo.trksess',JSON.stringify(unequalSession,null,2)+'\n');
const equalSession=structuredClone(unequalSession);
equalSession.request.requestId='e7c00000-0000-4000-8000-000000000603';
equalSession.request.snapshotId='e7c00000-0000-4000-8000-000000000604';
equalSession.request.dataset.label='Equal weights · comparison only';
equalSession.request.uncertainty={kind:'unknown-equal',errorStructure:'uncorrelated'};
// Deliberately withhold inference assertions for this misspecified noise model.
equalSession.request.dataset.assumptions={exactX:'asserted',gaussianIndependent:'unknown',correctModel:'unknown'};
equalSession.request.source.context += '; control: true unequal uncertainties withheld from fitter; equal weighting is intentionally misspecified; inference assertions withheld for descriptive comparison';
writeFileSync('examples/fit/equal-weights-comparison.trksess',JSON.stringify(sessionSchema.parse(equalSession),null,2)+'\n');
writeFileSync('examples/fit/unequal-weights-data.csv',[
 'row_id,x_s,y_m,sigma_y_m,inverse_variance_weight',
 ...unequalRequest.dataset.rows.map(row=>[row.id,row.x,row.y,sigmaByRow[row.id],1/sigmaByRow[row.id]**2].join(',')),
].join('\n')+'\n');

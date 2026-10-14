# Independent reviewer prompt

Review only the current story and changes against acceptance criteria. Run actual tests, inspect server-side authorization and DB transactions, seek missing error states and fake implementations, look for repeated generic layout, and verify the app still uses zero external services. Do not mark tasks complete if a test was skipped, mocked improperly, or a screenshot is absent. Supply succinct evidence and unresolved issues. Never execute `loop.py approve`.

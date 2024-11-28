
cd streams
yarn unlink
yarn link
cd ..

cd query
yarn unlink
yarn link
yarn link @andyfischer/streams
cd ..

cd node-tool
yarn unlink
yarn link
yarn link @andyfischer/streams
yarn link @andyfischer/query
cd ..

cd remote-streams
yarn unlink
yarn link
yarn link @andyfischer/streams
yarn link @andyfischer/query
cd ..


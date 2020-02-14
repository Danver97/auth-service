DIRNAME=$(dirname $0)
# mkdir $DIRNAME/node_modules
CWD=$(pwd)
cd $DIRNAME
npm install
ZIP_NAME=mongodb.zip
if test -f $ZIP_NAME; then
    rm $ZIP_NAME
fi
zip -r $ZIP_NAME . -x prova.js
rm -r ./node_modules
cd $CWD
mv $DIRNAME/$ZIP_NAME $CWD

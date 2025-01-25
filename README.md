# Usage
Needs to run on the same machine where there is VolaSki Alp Pro installed.


## Installation
Install AWS SDK 
To install needed packages
```
npm install aws-sdk
npm install sqlite3
```
## Set Up AWS S3 Access
Make sure that your AWS credentials are set up correctly. You can set them as environment variables or configure them using the AWS CLI (aws configure). Alternatively, you can hardcode them in the code above (not recommended for production).
```
aws configure
```
This command will prompt you to enter:

- AWS Access Key ID
- AWS Secret Access Key
- Default region name
- Default output format
This will store your credentials and region in the file ~/.aws/credentials and ~/.aws/config.

If you are using non-default AWS credentials please setup them in env variable before running the application
```
set AWS_PROFILE=myProfile
```

## Execution
```
node index.js s3bucket EventXXXEx.scsb EventXXX.scdb
```
e.g.
```
node index.js vola-poorman c:\SkiAlpPro\Events\Event019Ex.scdb c:\SkiAlpPro\Events\Event019.scdb
```

Outputs HTML file named skiers_data.html

## Disclamer
Code is created using ChatGPT

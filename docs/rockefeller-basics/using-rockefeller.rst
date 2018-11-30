.. _using-rockefeller:

Using Rockefeller
=========================
Rockefeller is a command-line utility that you can use to facilitate creation of CodePipelines that use the Handel library for deployment. This page details how to use this library.

AWS Permissions
---------------
When you run Rockefeller to deploy a new pipeline, you must run it with a set of AWS IAM credentials that have administrator privileges. This is because Rockefeller creates roles for the deploy phase of the pipeline that have administrator privileges. 

Once the pipeline is deployed, it will only use the created role for deployments, so you won't need to keep the user around with administrator privileges. Since human users are recommended to have non-administrative permissions, it is recommended you use a temporary user with admin permissions to create the pipeline, then delete that user once the pipeline is created.

Creating New Pipelines
----------------------
To deploy a new pipeline, do the following:

1. Create a new :ref:`rockefeller-file` in your repository. 
2. Install Rockefeller:

    .. code-block:: none
    
        npm install -g rockefeller

3. Ensure you have your AWS credentials configured on the command line.

    .. code-block:: none

        # This command will prompt you for your AWS Access Key ID and Secret Access Keys
        aws configure 

    .. NOTE::

        If you specified a profile when running *aws configure* above, you'll need to make Rockefeller aware of which profile to use by setting the AWS_PROFILE environment variable. 

        For example, if you configured your credentials in a profile named *my-account*, you'll run ``export AWS_PROFILE=my-account`` on Mac/Linux to set the environment variable that tells Rockefeller which profile to use.

4. Run Rockefeller:

    .. code-block:: none

        rockefeller deploy

5. Rockefeller will walk you through a series of questions, asking you to provide further input:

    .. code-block:: none

        Welcome to the Rockefeller setup wizard
        ? Please enter the name of the pipeline from your rockefeller.yml file that you would like to deploy prd
        ? Please enter the name of the account where your pipeline will be deployed my-account
        ? Please enter the path to the directory containing the Handel account configuration files /path/to/account/config/files
        ? Please enter a valid GitHub access token (CodePipeline will use this to pull your repo) SOMEFAKETOKEN

After you provide the appropriate input, Rockefeller will deploy the pipeline with the specified phases.
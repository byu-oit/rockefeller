CodeBuild
=========
The *CodeBuild* phase type configures a pipeline phase to build the source code pulled from the repository. The second phase of every pipeline created with Rockefeller must be a build code phase such as this CodeBuild type.

Build Configuration
-------------------
You can specify any arbitrary build process in this phase using the `buildspec.yml file <http://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html>`_. You must have this *buildspec.yml* file in the root of your repository or the CodeBuild phase will fail.

Parameters
----------

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - type
     - string
     - Yes
     - codebuild
     - This must always be *codebuild* for the CodeBuild phase type.
   * - name
     - string
     - Yes
     -
     - The value you want to show up in the CodePipeline UI as your phase name.
   * - build_image
     - string
     - Yes
     - 
     - The name of the CodeBuild image to use when building your code. See the `CodeBuild documentation <http://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref.html>`_ for a list of images.
   * - environment_variables
     - map
     - No
     - {}
     - A set of key/value pairs that will be injected into the running CodeBuild jobs.
   * - cache
     - string
     - No
     - `no-cache`
     - Whether to enable a build cache for this phase. Valid values are `no-cache` and `s3`.
   * - build_role
     - string
     - No
     - Handel-created role
     - The role that will be assigned to the CodeBuild project. This role must already exist in your account and must be assumable by CodeBuild.

.. NOTE::

  You can use a custom build image in your account's EC2 Container Registry by prefixing the build_image parameter with *<account>/*. For example, *<account>/IMAGE:TAG* will resolve at run-time to AWS_ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com/IMAGE:TAG.
  
  Using a custom build image also configures the CodeBuild image in privileged mode, which allows you to run Docker inside your image if needed.

Secrets
-------
This phase type doesn't prompt for any secrets when creating the pipeline.

Example Phase Configuration
---------------------------
This snippet of a rockefeller.yml file shows the CodeBuild phase being configured:

.. code-block:: yaml
    
    version: 1

    pipelines:
      dev:
        phases:
        ...
        - type: codebuild
          name: Build
          build_image: aws/codebuild/docker:1.12.1
          environment_Variables:
            MY_CUSTOM_ENV: my_custom_value
        ...

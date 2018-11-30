.. _cli-reference:

CLI Reference
=============

The Rockefeller command-line interface should be run in a directory with a `rockefeller.yml` file.

It defines four commands: `check`, `deploy`, `delete` and `list-required-secrets`

.. _cli-check:

`rockefeller check`
---------------------------

Validates that a given Rockefeller configuration is valid.

Parameters
~~~~~~~~~~

`rockefeller check` does not accept parameters.

.. _cli-deploy:

`rockefeller deploy`
-----------------------------

Validates and deploys the resources in a given environment.

Parameters
~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - --pipeline <value>
     - string
     - Yes
     -
     - The pipeline from your rockefeller.yml file that you wish to deploy.
   * - --account_name <value>
     - string
     - Yes
     -
     - The account you are deploying into.
   * - --secrets <value>
     - :ref:`secrets`
     - yes
     - 
     - The base64 encoded JSON string of the deploy secrets.  See :ref:`secrets`
    
.. _secrets:

Secrets
~~~~~~~
A base64 encoded array of secrets objects.  Note that the required secrets can be obtained with :ref:`list-required-secrets`.

.. code-block:: js

    [
      {
          "phaseName": "Github", // The phase the secret is associated with.
          "name": "githubAccessToken", // The name of the secret
          "message": "'Github' phase - Please enter your GitHub access token", // This is not necessary, but will be present if the original object was obtained from rockefeller list-required-secrets.
          "value": "ABCDEFGHIJKLMNOPQRSTUVWXYZ" // The secret's value
      }
    ]

.. _cli-delete:

`rockefeller delete`
----------------------------

Deletes the AWS CodePipeline.

Parameters
~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - --pipeline <value>
     - string
     - Yes
     -
     - The pipeline from your rockefeller.yml file that you wish to delete.
   * - --account_name <value>
     - string
     - Yes
     -
     - The account you are deploying into.

.. _list-required-secrets:

`rockefeller list-required-secrets`
-------------------------------------------

Returns a JSON string with all of the secrets required for the pipeline.

Parameters
~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - --pipeline <value>
     - string
     - Yes
     -
     - The pipeline from your rockefeller.yml file that you want to retreive required secrets from.

Example Response
~~~~~~~~~~~~~~~~

.. code-block:: js

    [
      {
        "phaseName": "Github",
        "name": "githubAccessToken",
        "message": "'Github' phase - Please enter your GitHub access token"
      },
      {
        "phaseName": "npmDeploy",
        "name": "npmToken",
        "message": "npmDeploy' phase - Please enter your NPM Token"
      },
      {
        "phaseName": "pypiDeploy",
        "name": "pypiUsername",
        "message": "'pypiDeploy' phase - Please enter your PyPi username"
      },
      {
        "phaseName": "pypiDeploy",
        "name": "pypiPassword",
        "message": "'pypiDeploy' phase - Please enter your PyPi password"
      },
      {
        "phaseName": "RunscopeTests",
        "name": "runscopeTriggerUrl",
        "message": "'RunscopeTests' phase - Please enter your Runscope Trigger URL"
      },
      {
        "phaseName": "RunscopeTests",
        "name": "runscopeAccessToken",
        "message": "'RunscopeTests' phase - Please enter your Runscope Access Token"
      },
      {
        "phaseName": "Notify",
        "name": "slackUrl",
        "message": "'Notify' phase - Please enter the URL for Slack Notifications"
      }
    ]


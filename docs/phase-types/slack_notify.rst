Slack Notify
============
The *Slack Notify* phase type configures a pipeline phase to send a notification to a Slack channel.

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
     - slack_notify
     - This must always be *slack_notify* for the Slack Notify phase type.
   * - name
     - string
     - Yes
     -
     - The value you want to show up in the CodePipeline UI as your phase name.
   * - message
     - string
     - Yes
     - 
     - The message to send to the Slack channel when this phase executes.
   * - channel
     - string
     - Yes
     - 
     - The Slack channel you wish to send to. This can either be a username, such as "@dsw88", or a channel, such as "#mydeploys". 

.. IMPORTANT::

    In the *channel* parameter above, make sure that you put your channel names in quotes, since YAML treats the *#* character as a comment and will cause your Handel-CodePipeline file to be invalid.

Secrets
-------
In addition to the parameters specified in your handel-codepipeline.yml file, this phase will prompt you for the following secret information when creating your pipeline:

* Slack notify URL

This is not saved in your handel-codepipeline.yml file because by having this URL others can also post to your Slack instance.

Example Phase Configuration
---------------------------
This snippet of a handel-codepipeline.yml file shows the GitHub phase being configured:

.. code-block:: yaml
    
    version: 1

    pipelines:
      dev:
        ...
        phases:
        - type: slack_notify
          name: Notify
          channel: "#mydeployschannel"
          message: Successfully deployed the app!
        ...

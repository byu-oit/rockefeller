Introduction
============
Rockefeller is a command-line library that helps you easily create Continuous Delivery pipelines in the AWS CodePipeline service.

Included in this library is the support for doing deployments using the `Handel deployment library <https://handel.readthedocs.io>`_.

How does this library work?
---------------------------
You specify a file called *rockefeller.yml* in your code repository. This file contains a YAML specification of how the library should configure your pipeline.

Once you've defined your *rockefeller.yml* file, you can run the library. It will prompt you for further pieces of information, after which it will create the pipeline.
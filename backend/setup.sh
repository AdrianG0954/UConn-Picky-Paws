#!/bin/bash
# RUN THIS COMMAND WITH source ./local_setup.sh
# If not using source, it will be unable to use any source commands on your current shell environment

# create virtual environment
python3 -m venv .venv

# activate virtual environment
source .venv/bin/activate

# install dependencies
pip3 install -r requirements.txt


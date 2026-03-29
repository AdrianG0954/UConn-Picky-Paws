#!/usr/bin/env fish
# RUN THIS COMMAND WITH source ./setup.fish
# If not using source, it will be unable to use any source commands on your current shell environment

# create virtual environment
python3 -m venv .venv

# activate virtual environment
source .venv/bin/activate.fish

# install dependencies
pip install --upgrade pip
pip install -r requirements.txt

import logging
import os

print("--- Test Script: Standard Print Output ---")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("--- Test Script: Logging Info Output ---")
logging.warning("--- Test Script: Logging Warning Output ---")
logging.error("--- Test Script: Logging Error Output ---")

print(f"Current working directory: {os.getcwd()}")

# Test file creation
test_file_path = "_test_output_was_here.txt"
try:
    with open(test_file_path, "w") as f:
        f.write("Test script successfully created this file.")
    print(f"Successfully created {test_file_path}")
except Exception as e:
    print(f"Error creating {test_file_path}: {e}")
    logging.error(f"Error creating {test_file_path}: {e}")

print("--- Test Script: End ---")

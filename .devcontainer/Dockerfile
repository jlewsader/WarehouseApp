FROM fedora:latest

# Create a normal user
RUN useradd -m vscode

# Install tooling
RUN dnf upgrade -y && dnf install -y \
    git \
    curl \
    wget \
    nodejs npm \
    gcc gcc-c++ make \
    sqlite \
    sqlite-devel \
    && dnf clean all

# Set HOME explicitly
ENV HOME=/home/vscode
USER vscode
WORKDIR /workspace

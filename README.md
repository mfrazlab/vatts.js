<div align="center">  
  <picture>  
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png">  
      <img alt="Vatts.js logo" src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png" width="128">  
    </picture>  
  <h1>Vatts.js</h1>  

[![NPM](https://img.shields.io/npm/v/vatts.svg?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/vatts)  
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge&labelColor=000000)](./LICENSE)  
[![GitHub](https://img.shields.io/badge/GitHub-mfrazlab/vatts.js-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mfrazlab/vatts.js)

[![HTTP/3 Supported](https://img.shields.io/badge/SUPPORTED-HTTP/3-brightgreen?style=for-the-badge&labelColor=000000)](#)
</div>

---




## Getting Started

**Vatts.js** is a modern, full-featured web framework for **Node.js** with first-class support for **React and Vue**.

It is the first framework to offer native HTTP/3 support out of the box. Powered by an internal proxy engine that enables HTTP/3 with SSL termination. This means your applications benefit from the latest web transport protocol.

Vatts.js is a **multi-framework platform**, allowing you to build applications using **either React or Vue per project** — not both at the same time.  
This keeps the ecosystem clean, predictable, and optimized for performance and tooling.

Vatts removes unnecessary configuration and complex abstractions, allowing you to focus on what truly matters: **building fast, secure, and scalable applications**.

### Why choose Vatts.js?
-  **Native Proxy** — modern, secure, and high-performance networking with **HTTP/3 support**
-  Extremely fast — architecture optimized for low overhead
-  Intuitive API — easy to learn and pleasant to use
-  Productivity from the first minute — zero unnecessary boilerplate
-  Multi-framework — choose **React or Vue per project**
-  Full integration between backend and frontend
-  Built for modern projects — TypeScript-friendly, modular, and extensible

___

## Documentation

Visit [https://vatts.mfraz.ovh](https://vatts.mfraz.ovh) to view the full documentation.

___

## Community

The Vatts.js community can be found on [GitHub Discussions](https://github.com/mfraz/vatts.js), where you can ask questions, share ideas, and showcase your projects with others.

___


## Security

Vatts.js is engineered with a security-first architecture centered around an internal proxy layer that mediates all application traffic. This proxy is designed to support modern transports such as native HTTP/3 when SSL is enabled, while consistently enforcing built-in security guarantees at the protocol and application boundaries. Even in local or non-TLS environments, the proxy remains active, preserving request isolation, and secure handling by default.

If you believe you have found a security vulnerability in Vatts.js, we encourage you to **responsibly disclose it and NOT open a public issue**.

To participate in our vulnerability disclosure program, please email [helpers@mfraz.ovh](mailto:help@mfraz.ovh). We will add you to the program and provide further instructions for submitting your report.

___

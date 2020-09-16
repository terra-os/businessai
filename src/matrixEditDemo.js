export default function () {
  return [
    [
      `- # Microservices / Node & React
TerraOfficeVM`, "mins", "%",
`https://regexr.com/ |  https://skaffold.dev  | https://www.npmjs.com/package/supertest | 
https://jestjs.io/ |  | https://getbootstrap.com/ | base64decode.org | https://docs.nats.io/ |`,
`https://github.com/OptimalBits/bull | https://docs.github.com/en/actions |  
https://stripe.com/docs/api | https://www.npmjs.com/package/react-stripe-checkout   |
https://stripe.com/docs/api/charges/create | 
https://docs.github.com/en/actions/reference/events-that-trigger-workflows`,
    ],
    [
"- Screenshots","301","",`# 

- 
`,`
---
        
---
`
,""
    ],
    [
      "- ## Section 7: Cross - Service Data Replication","","","","",""
    ],
    [
      "- 315. The Orders Service 5min","","",`# The Orders Service

Services 
1 - auth - Everything related to user signup/signin/signout 
2 - tickets - Ticket creation/editing. Knows whether a ticket can be updated 
3 - orders - Order creation/editing 
4 - expiration - Watches for orders to be created, cancels them after 15 minutes 
5 - payments - Handles credit card payments. Cancels orders if payments fails, 
completes if payment succeeds

- Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type Event ticket:created Event ticket:updated version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we dont process events twice or out of order

    `,
    `ingress-srv.yaml
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-service
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/use-regex: true
---
      `,
],
[
  `- 316. Scaffolding the Orders Service 5min`, "","",`# Orders Service Setup

1 - Duplicate the 'tickets' service
2 - Install dependencies / $ orders % npm install
3 - Build a docker image out of the orders service % docker build -t stefian22/orders .
4 - Create a Kubernetes deployment file / orders-depl.yaml, orders-mongo-depl.yaml
5 - Set up file sync options in the skaffold.yaml file

- image: stefian22/orders # or for GCP: us.gcr.io/aibazar-dev/orders
      context: orders
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: "src/**/*.ts"
            dest: .

6 - Set up routing rules in the ingress service # ToDo next
`,"",""
    ],
    [
      `- # Microservices / Node & React
TerraOfficeVM`, "mins", "%",
`https://regexr.com/ |  https://skaffold.dev  | https://www.npmjs.com/package/supertest | 
https://jestjs.io/ |  | https://getbootstrap.com/ | base64decode.org | https://docs.nats.io/ |`,
`https://github.com/OptimalBits/bull | https://docs.github.com/en/actions |  
https://stripe.com/docs/api | https://www.npmjs.com/package/react-stripe-checkout   |
https://stripe.com/docs/api/charges/create | 
https://docs.github.com/en/actions/reference/events-that-trigger-workflows`,
    ],
    [
"- Screenshots","301","",`# 

- 
`,`
---
        
---
`
,""
    ],
    [
      "- ## Section 7: Cross - Service Data Replication","","","","",""
    ],
    [
      "- 315. The Orders Service 5min","","",`# The Orders Service

Services 
1 - auth - Everything related to user signup/signin/signout 
2 - tickets - Ticket creation/editing. Knows whether a ticket can be updated 
3 - orders - Order creation/editing 
4 - expiration - Watches for orders to be created, cancels them after 15 minutes 
5 - payments - Handles credit card payments. Cancels orders if payments fails, 
completes if payment succeeds

- Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type Event ticket:created Event ticket:updated version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we dont process events twice or out of order

    `,
    `ingress-srv.yaml
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-service
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/use-regex: true
---
      `,
],
[
  `- 316. Scaffolding the Orders Service 5min`, "","",`# Orders Service Setup

1 - Duplicate the 'tickets' service
2 - Install dependencies / $ orders % npm install
3 - Build a docker image out of the orders service % docker build -t stefian22/orders .
4 - Create a Kubernetes deployment file / orders-depl.yaml, orders-mongo-depl.yaml
5 - Set up file sync options in the skaffold.yaml file

- image: stefian22/orders # or for GCP: us.gcr.io/aibazar-dev/orders
      context: orders
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: "src/**/*.ts"
            dest: .

6 - Set up routing rules in the ingress service # ToDo next
`,"","",
    ],
[`# The Orders Service

Services 
1 - auth - Everything related to user signup/signin/signout 
2 - tickets - Ticket creation/editing. Knows whether a ticket can be updated 
3 - orders - Order creation/editing 
4 - expiration - Watches for orders to be created, cancels them after 15 minutes 
5 - payments - Handles credit card payments. Cancels orders if payments fails, 
completes if payment succeeds

- Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type Event ticket:created Event ticket:updated version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we don't process events twice or out of order


`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2026.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2025.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2024.png")`,]
  ]
}
export default function () {
  return [
    [
      [
        `# The Orders Service

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

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2026.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2025.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2024.png")`,
      ], [
        `# Orders Service Setup

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
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2027.png")`,
      ], [
        `# Cont. Set up Orders Service 

- 
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2028.png")`,
      ], [
        `# Set up routing rules in the ingress service 

- orders service Routes
Method Route Body Purpose
- GET /api/orders - Retrieve all active orders for the given user making the request 
- GET /api/orders/:id - Get details about a specific order
- POST /api/orders { ticketId: string } - Create an order to purchase the specified ticket
- DELETE /api/orders/:id - Cancel the order

- 
`,`ingress-srv.yaml
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-service
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
    - host: aibazar.dev
      http:
        paths:
          - path: /api/users/?(.*)
            backend:
              serviceName: auth-srv
              servicePort: 3000
          - path: /api/tickets/?(.*)
            backend:
              serviceName: tickets-srv
              servicePort: 3000
          - path: /api/orders/?(.*)
            backend:
              serviceName: orders-srv
              servicePort: 3000
          - path: /?(.*)
            backend:
              serviceName: client-srv
              servicePort: 3000

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2029.png")`,
    
      ], [
        `# Orders Route Handlers

orders service Routes
Method Route Body Purpose
- GET /api/orders - Retrieve all active orders for the given user making the request 
- GET /api/orders/:id - Get details about a specific order
- POST /api/orders { ticketId: string } - Create an order to purchase the specified ticket
- DELETE /api/orders/:id - Cancel the order

- Copy files from tickets / modify update => delete.ts

NOTE / COGITO : in Cogito Orders = Projects !!!
  - and projects can be updated !!!
  - Projects shouldn't be deleted but archived !!! via updating status ?!
  => added also an update.ts 

- 




`,`orders/src/app.ts
---
import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";
import {
  errorHandler,
  NotFoundError,
  currentUser,
} from "@w3ai/common";

import { deleteOrderRouter } from "./routes/delete";
import { indexOrderRouter } from "./routes/index";
import { newOrderRouter } from "./routes/new";
import { showOrderRouter } from "./routes/show";
import { updateOrderRouter } from "./routes/update";

const app = express();
app.set("trust proxy", true); // to allow traffic through ingress-nginx
app.use(json());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== "test", // to ensure it will always work on https connection or http for testing
  })
);
app.use(currentUser);

app.use(deleteOrderRouter);
app.use(indexOrderRouter);
app.use(newOrderRouter);
app.use(showOrderRouter);
app.use(updateOrderRouter);
---`,`orders/src/routes/index.ts
---
import express, { Request, Response } from "express";

const router = express.Router();

router.get("/api/orders", async (req: Request, res: Response) => {
  res.send({});
});

export { router as indexOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2031.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2029.png")`,
    
      ], [
        `# Subtle Service Coupling with the Tickets service

- if assuming and validating that the ticket id has the structure of a mongodb id
  - the ticket service might use a diff db in the future

- we are adding though a check to validate that the ticket id looks like a mongo id


`,`orders/src/routes/new.ts
---
import mongoose from "mongoose";
import express, { Request, Response } from "express";
import { requireAuth, validateRequest } from "@w3ai/common";
import { body } from "express-validator";

const router = express.Router();

router.post(
  "/api/orders",
  requireAuth,
  [
    body("ticketId")
      .not()
      .isEmpty()
      .custom((input: string) =>
        mongoose.Types.ObjectId.isValid(input)
      )
      .withMessage("TicketId must be provided"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    res.send({});
  }
);

export { router as newOrderRouter };

---`,
    
      ], [
        `# Associating Orders and Tickets

- Building an order model to describe what an order is and how to save it to the 
service db 
together with the associated ticket

- We need to mark a ticket as reserved / associated with a particular order

- 2 ways / strategies to do this with mongodb / mongoose:
  Option 1 - Embedding tickets into orders - plain obj inside the order {id: , price: , title: }
      - Con 1 - Querying is just a bit challenging - need to check all orders to see if ticket
                     is not already reserved ...
      - Con 2 - We still need to implement a Pool of records inside Orders db to store
                     tickets not associated with an order / unreserved yet

  Option 2 - Using Ref / Population feature in Mongoose / mongo << To Implement
             - we'll have 2 collections: orders and tickets
             - inside every order, optionally there could be a reference to a ticket`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2032.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2036.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2035.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2034.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2033.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2025.png")`,
    
      ], [
        `# Order Model Setup

- Whenever we need to have Mongoose and TS to work together we need to implement
  3 interfaces in the model: ~ same as in auth / user model file : 
    a - describe the props to create a user / record / order
    b - describe the props of the overall mongoose model / object has 
         - includes the build method :

  interface UserModel extends mongoose.Model<UserDoc> {
    build(attrs: UserAttrs): UserDoc;
  }

    c - describe the props of a Mongo Doc 

- all these interfaces are to allow typescript to do validation / type checking on 
  the arguments we use to create a new doc

- `,`orders/src/models/order.ts
---
import mongoose, { Mongoose } from "mongoose";

interface OrderAttrs {
  userId: string;
  status: string;
  expiresAt: Date;
  ticket: TicketDoc;
}

interface OrderDoc extends mongoose.Document {
  userId: string;
  status: string;
  expiresAt: Date;
  ticket: TicketDoc;
}

interface OrderModel extends mongoose.Model<OrderDoc> {
  build(attrs: OrderAttrs): OrderDoc;
}
---`,`orders/src/models/order.ts
---
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: mongoose.Schema.Types.Date,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

orderSchema.statics.build = (attrs: OrderAttrs) => {
  return new Order(attrs);
};

const Order = mongoose.model<OrderDoc, OrderModel>(
  "Order",
  orderSchema
);

export { Order };

---`,
    
      ], [
        `# Defining the Status of an Order

- Orders Service Expiration Service Payments Service 
Need a shared and exact definition of the different statuses an order can have!

- Solution: Defining the OrderStatus in the Common Library and 
  Share it among the different Services

- enum OrderStatus to list 
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2043.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2041.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2040.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2039.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2038.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2037.png")`,
    
      ], [
        `# Creating an OrderStatus Enum

- Cancelled is a kind of Catch All status => can be split in 3 to provide more info as of 
  why it was cancelled ... we won't do it now

- But might be important to define / detail for Cogito's Market tx states 

- $ common % npm run pub  

- cd ..

cd orders

$ orders % npm update @w3ai/common

- Cmd + Shift + P > Reload Window

- 


`,`common/src/events/types/order-status.ts
---
export enum OrderStatus {
  // When the order has beeb created, but the
  // ticket it is trying to order has not been reserved
  Created = "created",

  // The ticket the order is trying to reserve has already
  // been reserved, or when the user has cancelled the order.
  // The order expires before payment
  Cancelled = "cancelled",

  // The order has successfully reserved the ticket
  AwaitingPayment = "awaiting:payment",

  // The order has reserved the ticket and the user has
  // provided payment successfully
  Complete = "complete",
}

---`,`common/src/index.ts
---
// Export errors and middlewares initially in market auth
export * from "./errors/bad-request-error";
export * from "./errors/custom-error";
export * from "./errors/database-connection-error";
export * from "./errors/not-authorized-error";
export * from "./errors/not-found-error";
export * from "./errors/request-validation-error";

export * from "./middlewares/current-user";
export * from "./middlewares/error-handler";
export * from "./middlewares/require-auth";
export * from "./middlewares/validate-request";

export * from "./events/base-listener";
export * from "./events/base-publisher";
export * from "./events/subjects";
export * from "./events/ticket-created-event";
export * from "./events/ticket-updated-event";
export * from "./events/types/order-status";

---`,
    
      ]
    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]
    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ]
  ]
}
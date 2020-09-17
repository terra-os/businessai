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
        `# Mongoose Refs

- Need to Create a Ticket Model for the tickets inside the Order service

- these tickets will be referenced through the ref / population feature in mongoose

=> 1 -  Create / Save Order + Ticket

=> 2 -  Associate an existing Ticket with a new Order

=> 3 -  Fetch and reference an exisiting Order and its associated Ticket
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2047.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2049.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2048.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2050.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2052.png")`,
    
      ], [
        `# Defining the Ticket Model / Data Layer for the Order Service

- Import mongoose and define the 3 TS / Mongoose interfaces

import mongoose from 'mongoose';

interface TicketAttrs {

}

interface TicketDoc extends mongoose.Document {

}

interface TicketModel extends mongoose.Model<TicketDoc> {
  
}

=> Replication of Data between services !!! 
  => is there opportunity for a common shared library ? =>> No ! Don't !

- this could be very specific for this service
  - with attributes just for the Orders service needs to work correctly
  - there might be other attributes saved in the db of the Tickets Service
    that are not relevent for the Orders service
  - Orders Service only needs : Ticket Title, Price, Version and ticketId

=> Definetly we need different defs between Ordrs and Tickets 
  even if largely overlapping and redundant

- Also Orders might grow to incapsulate things that can be ordered / purchased 
  that are not tickets !!! - eg: Services / Tasks / CMDs / for Cogito Markets / PMOs
  - or Parking services
`,`orders/src/models/ticket.ts
---
import mongoose from "mongoose";

interface TicketAttrs {
  title: string;
  price: number;
}

export interface TicketDoc extends mongoose.Document {
  title: string;
  price: number;
}

interface TicketModel extends mongoose.Model<TicketDoc> {
  build(attrs: TicketAttrs): TicketDoc;
}

---`,`orders/src/models/ticket.ts
---
const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
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

ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket(attrs);
};

const Ticket = mongoose.model<TicketDoc, TicketModel>(
  "Ticket",
  ticketSchema
);

export { Ticket };
---`,`Order Service data structures :

Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we don't process events twice or out of order ticket:updated { id: 'abc', price: 10, version: 2 } ticket:updated { id: 'abc', price: 20, version: 3 } ticket:updated { id: 'abc', price: 30, version: 4 }`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2054.png")`,
    
      ], [
        `# Planning the tasks for the Order Creation Logic

    // Find the ticket the user is trying to order in the database

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created
`,`orders/src/routes/new.ts
---
  async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created

    res.send({});
  }

---`,
    
      ], [
        `# Finding Reserved Tickets

- Find the order - not cancelled where the ticket we try to reserve

- use mongodb operator : $in :

    // Make sure that this ticket is not already reserved 
      - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const existingOrder = await Order.findOne({
      ticket: ticket,
      status: {
        $in: [
          OrderStatus.Created,
          OrderStatus.AwaitingPayment,
          OrderStatus.Complete
        ]
      }
    });
    if (existingOrder) {
      throw new BadRequestError('Ticket is already reserved');
    }
`,`new.ts
---
    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const existingOrder = await Order.findOne({
      ticket: ticket,
      status: {
        $in: [
          OrderStatus.Created,
          OrderStatus.AwaitingPayment,
          OrderStatus.Complete
        ]
      }
    });
    if (existingOrder) {
      throw new BadRequestError('Ticket is already reserved');
    }
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2056.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2055.png")`,
    
      ], [
        `# Refactor Finding Existing Order logic 

- build isReserved() method in the TicketDoc interface : - to reduce / re-use code :

export interface TicketDoc extends mongoose.Document {
  title: string;
  price: number;
  isReserved(): Promise<boolean>; // ~ isBooked(), isScheduled(), isPlanned()
}

- 
`,`models/ticket.ts
---
ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket(attrs);
};
ticketSchema.methods.isReserved = async function () {
  // use function keyword in order to be able to use 'this' inside
  const existingOrder = await Order.findOne({
    ticket: this,
    status: {
      $in: [
        OrderStatus.Created,
        OrderStatus.AwaitingPayment,
        OrderStatus.Complete,
      ],
    },
  });

  return !!existingOrder; // to return a boolean as per def
};

const Ticket = mongoose.model<TicketDoc, TicketModel>(
  "Ticket",
  ticketSchema
);

export { Ticket };

---`,`orders/src/routes/new.ts
---
async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const isReserved = await ticket.isReserved();
    if (isReserved) {
      throw new BadRequestError("Ticket is already reserved");
    }

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created

    res.send({});
  }
---`,
    
      ], [
        `# Calculate an Expiration Time for the Order

- const EXPIRATION_WINDOW_SECONDS = 15 * 60; // 15mins in seconds

- Move const to an Environment var to not have to re-deploy on change !!!

- Or even fancier - Put it in the DB to allow the admin to change it on the fly !!!

- You can have !!! Per user Expiration Settings !!! <<< ToDo for Cogito !!! 

- 
`,`new.ts
---
  async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    const isReserved = await ticket.isReserved();
    if (isReserved) {
      throw new BadRequestError("Ticket is already reserved");
    }

    // calculate an expiration date for this order
    const expiration = new Date(); // = Now - Current Date/Time
    expiration.setSeconds(
      expiration.getSeconds() + EXPIRATION_WINDOW_SECONDS
    );

    // Build the order and save it to the database
    const order = Order.build({
      userId: req.currentUser!.id,
      status: OrderStatus.Created,
      expiresAt: expiration,
      ticket,
    });
    await order.save();

    // Publish an event saying that an order was created

    res.status(201).send(order);
---`,
    
      ], [
        `# Test Suite Setup for Orders Service

- Copy test/setup from tickets dir

- Cmd + Shift + P - Reload VSCode window

- Copy __mocks__ folder from tickets
`,`
---

---`,
    
      ], [
        `# Asserting Tickets Exist test

- Tests :
  - user tries to reserve a ticket that dos not exist
  - user tries to reserve a ticket already reserved
  - test the successfully reserving a ticket

- we need to prep tickets in db to ensure tests work ...

- 
`,`new.test.ts
---
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../../app";

it("returns an error if the ticket does not exist", async () => {
  const ticketId = mongoose.Types.ObjectId();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId })
    .expect(404);
});

it("returns an error if the ticket is already reserved", async () => {});

it("reserves a ticket", async () => {});

---`,
    
      ], [
        `# Testing / Asserting Reserved Tickets

- 
`,`new.test.ts
---
it("returns an error if the ticket is already reserved", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();
  const order = Order.build({
    ticket,
    userId: "randomUserId",
    status: OrderStatus.Created,
    expiresAt: new Date(),
  });
  await order.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(400);
});
---`,
    
      ], [
        `# Testing the New Order Created Successfully case

- 
`,`new.test.ts
---
it("reserves a ticket", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(201);
});
---`,
    
      ]
    ],
    [
      [
        `# Fetching a User's Orders

- implement all routes before implementing the messaging through the event bus

- Adding ToDos in test files :
  it.todo("emits an order created event");


`,`orders/scr/routes/index.ts
---
import express, { Request, Response } from "express";
import { requireAuth } from "@w3ai/common";
import { Order } from "../models/order";

const router = express.Router();

router.get(
  "/api/orders",
  requireAuth,
  async (req: Request, res: Response) => {
    const orders = await Order.find({
      userId: req.currentUser!.id,
    }).populate("ticket");

    res.send(orders);
  }
);

export { router as indexOrderRouter };

---`,`new.test.ts
---
it.todo("emits an order created event");
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2057.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2058.png")`,
    
      ], [
        `# Testing the index route

- Comments to guide the coding:

  // Create 3 tickets

  // Create 1 order as User #1

  // Create 2 orders as User #2

  // Make request to get orders for User #2

  // Make sure we only got the orders for User #2

- helper function for building a ticket : 

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

- COGITO: ToDo: Define Accelerate / Amplify factor 
  ~ nr. characters (function implementation) / nr characters (command)

  eg: 152 / 11 = 13.81  // for the buildTicket above
`,`index.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Order } from "../../models/order";
import { Ticket } from "../../models/ticket";

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

it("fetches orders for a particular user", async () => {
  // Create 3 tickets
  const ticketOne = await buildTicket();
  const ticketTwo = await buildTicket();
  const ticketThree = await buildTicket();

  // Create 1 order as User #1
  // Create 2 orders as User #2
  // Make request to get orders for User #2
  // Make sure we only got the orders for User #2
});

---`,`index.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Order } from "../../models/order";
import { Ticket } from "../../models/ticket";

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

it("fetches orders for a particular user", async () => {
  // Create 3 tickets
  const ticketOne = await buildTicket();
  const ticketTwo = await buildTicket();
  const ticketThree = await buildTicket();

  const userOne = global.signin();
  const userTwo = global.signin();
  // Create 1 order as User #1
  await request(app)
    .post("/api/orders")
    .set("Cookie", userOne)
    .send({ ticketId: ticketOne.id })
    .expect(201);

  // Create 2 orders as User #2
  const { body: orderOne } = await request(app)
    .post("/api/orders")
    .set("Cookie", userTwo)
    .send({ ticketId: ticketTwo.id })
    .expect(201);
  const { body: orderTwo } = await request(app)
    .post("/api/orders")
    .set("Cookie", userTwo)
    .send({ ticketId: ticketThree.id })
    .expect(201);

  // Make request to get orders for User #2
  const response = await request(app)
    .get("/api/orders")
    .set("Cookie", userTwo)
    .expect(200);

  // Make sure we only got the orders for User #2
  expect(response.body.length).toEqual(2);
  expect(response.body[0].id).toEqual(orderOne.id);
  expect(response.body[1].id).toEqual(orderTwo.id);
  expect(response.body[0].ticket.id).toEqual(ticketTwo.id);
  expect(response.body[1].ticket.id).toEqual(ticketThree.id);
});

---`,`const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};`,`152=LEN(G372)`,`13.818181818181818=152/11`,
    
      ], [
        `# Implementing Show Request Handler

- 
`,`orders/src/routes/show.ts
---
import express, { Request, Response } from "express";
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from "@w3ai/common";
import { Order } from "../models/order";

const router = express.Router();

router.get(
  "/api/orders/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.orderId).populate(
      "ticket"
    );

    if (!order) {
      throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    res.send(order);
  }
);

export { router as showOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2060.png")`,
    
      ], [
        `# Test script for show.ts / show specific order

- 
`,`show.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";

it("fetches the order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  const { body: fetchedOrder } = await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(200);

  expect(fetchedOrder.id).toEqual(order.id);
});

it("returns an error if one user tries to fetch another users order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", global.signin())
    .send()
    .expect(401);
});

---`,`show.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";

it("fetches the order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  const { body: fetchedOrder } = await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(200);

  expect(fetchedOrder.id).toEqual(order.id);
});

---`,
    
      ], [
        `# Cancelling the Order

- We won't cancel the order - we'll just change status to Cancelled

- 
`,`orders/src/routes/delete.ts
---
import express, { Request, Response } from "express";
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from "@w3ai/common";
import { Order, OrderStatus } from "../models/order";

const router = express.Router();

router.delete(
  "/api/orders/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }
    order.status = OrderStatus.Cancelled;
    await order.save();

    res.status(204).send(order); // 204 - record deleted
  }
);

export { router as deleteOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2062.png")`,
    
      ], [
        `# Testing Deleting Order

- Comments to guide Coding the test:

  // create a ticket with Ticket model
  
  // make a request to create an order

  // make a request to cancel the order

  // expectation to make sure the thing is cancelled

`,`delete.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";
import { Order, OrderStatus } from "../../models/order";

it("marks an order as cancelled", async () => {
  // create a ticket with Ticket model
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // make a request to create an order
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a request to cancel the order
  await request(app)
    //.delete(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(204);

  // expectation to make sure the thing is cancelled
  const updatedOrder = await Order.findById(order.id);

  expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled);
});

it.todo("emits an order cancelled event");
---`,`delete.test.ts
---
import request from 'supertest';
import { app } from '../../app';
import { Ticket } from '../../models/ticket';

it('marks an order as cancelled', async () => {
  // create a ticket with Ticket model
  
  // make a request to create an order

  // make a request to cancel the order

  // expectation to make sure the thing is cancelled
});

---`,
    
      ], [
        `# Orders Service Events
Orders Service emits 2 types of Events:
- order:created
- order:cancelled

Order:Created Event
Tickets service 
needs to be told that one of its tickets has been reserved, 
and no further edits to that ticket should be allowed / lockdown ticket !!

Payments service 
needs to know there is a new order 
that a user might submit a payment for 

Expiration service 
needs to start a 15 minute timer to eventually time out this order

Order:Cancelled Event 
- Tickets service 
should unreserve a ticket if the corresponding order has been cancelled 
so this ticket can be edited again 
- Payments Service
should know that any incoming payments for this order should be rejected

Events Creation process :
0 - Add Event name to the Subjects enum in 
1 - Create Event Interface in common/src/events with Subject and Data
2 - then Republish the Common NPM  Module
3 - then Update the Common Module inside the Orders Service
`,`common/src/events/subjects.ts
---
export enum Subjects {
  TicketCreated = "ticket:created",
  TicketUpdated = "ticket:updated",
}

---`,`common/src/events/ticket-created-event.ts
---
import { Subjects } from "./subjects";

export interface TicketCreatedEvent {
  subject: Subjects.TicketCreated;
  data: {
    id: string;
    title: string;
    price: number;
    userId: string;
  };
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2074.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2075.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2072.png")`,
    
      ], [
        `# Creating the Events for the Orders Service

- order:created data needs to include
  - for Tickets service :
    - ticket.id
  - for Payments service :
    - user.id
    - ticket.price
  - for Expiration service
    - order.expiresAt
    - order.id

- We'll add also order.status as a provision for future Services

- order:cancelled data needs to include :
  - for Tickets service :
    - ticket.id - to know what ticket to un-reserve
  - for Payments service:
    - order.id

System Design Decision : 
A - Share Maximum info in events
B - Share Minimum info in Events - in our case we share minimum info needed

 because we know exactly what services and how they will use the events

- This is not Future Proof - There might be future servces that might need more data !!!
- in case of changes - the common  library needs to be Redeployed !!!

=> COGITO - might need to go with Max info until stabilized

$ common % npm run pub 
  cd .. && cd orders
$ orders % npm update @w3ai/common  
`,`order-created-event.ts
---
import { Subjects } from "./subjects";
import { OrderStatus } from "./types/order-status";

export interface OrderCreatedEvent {
  subject: Subjects.OrderCreated;
  data: {
    id: string;
    status: OrderStatus;
    userId: string;
    expiresAt: string;
    ticket: {
      id: string;
      price: number;
    };
  };
}

---`,`order-cancelled-event.ts
---
import { Subjects } from "./subjects";

export interface OrderCancelledEvent {
  subject: Subjects.OrderCancelled;
  data: {
    id: string;
    ticket: {
      id: string;
    };
  };
}

---`,`common/src/events/subjects.ts
---
export enum Subjects {
  TicketCreated = "ticket:created",
  TicketUpdated = "ticket:updated",

  OrderCreated = "order:created",
  OrderCancelled = "order:cancelled",
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
export * from "./events/order-cancelled-event";
export * from "./events/order-created-event";

---`,
    
      ], [
        `# Implementing Orders Publishers

- 
`,`order-created-publisher.ts
---
import { Publisher, OrderCreatedEvent, Subjects } from "@w3ai/common";

export class OrderCreatedPublisher extends Publisher<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
}

---`,`order-cancelled-publisher.ts
---
import { Publisher, OrderCancelledEvent, Subjects } from "@w3ai/common";

export class OrderCancelledPublisher extends Publisher<
  OrderCancelledEvent
> {
  readonly subject = Subjects.OrderCancelled;
}


---`,
    
      ], [
        `# Publishing the Order Created Event

- expiresAt - should be shared in a Time Zone agnostic way
  => a UTC timestamp


`,`new.ts
---
    // Publish an event saying that an order was created
    new OrderCreatedPublisher(natsWrapper.client).publish({
      id: order.id,
      status: order.status,
      userId: order.userId,
      expiresAt: order.expiresAt.toISOString(),
      ticket: {
        id: ticket.id,
        price: ticket.price
      }
    })
---`,
    
      ]

    ],
    [
      [
        `# Publishing the Order Cancelled Event

- 
`,`delete.ts
---
    // publish an event saying this order was cancelled!
    new OrderCancelledPublisher(natsWrapper.client).publish({
      id: order.id,
      ticket: {
        id: order.ticket.id,
      },
    });
---`,
    
      ], [
        `# Testing Publishing Order Events

- 
`,`new.test.ts
---
it("emits an order created event", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(201);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
---`,`delete.test.ts
---
it("emits an order cancelled event", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // make a request to create an order
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a request to cancel the order
  await request(app)
    //.delete(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(204);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});

---`,
    
      ], [
        `# Testing the Expiration Complete Listener / Orders Service

- the test setup function
`,`expiration-complete-listener.test.ts
---
import mongoose from "mongoose";
import { Message } from "node-nats-streaming";
import { OrderStatus, ExpirationCompleteEvent } from "@w3ai/common";
import { ExpirationCompleteListener } from "../expiration-complete-listener";
import { natsWrapper } from "../../../nats-wrapper";
import { Order } from "../../../models/order";
import { Ticket } from "../../../models/ticket";

const setup = async () => {
  const listener = new ExpirationCompleteListener(natsWrapper.client);

  const ticket = Ticket.build({
    id: mongoose.Types.ObjectId().toHexString(),
    title: "service",
    price: 20,
  });
  await ticket.save();
  const order = Order.build({
    status: OrderStatus.Created,
    userId: "alskdf",
    expiresAt: new Date(),
    ticket,
  });
  await order.save();

  const data: ExpirationCompleteEvent["data"] = {
    orderId: order.id,
  };

  // @ts-ignore
  const msg: Message = {
    ack: jest.fn(),
  };

  return { listener, order, ticket, data, msg };
};

---`,
    
      ], [
        `# Testing the Expiration Complete Listener / Orders Service - cont.

- it test scripts :

it('updates the order status to cancelled', async () => {

});

it('emit an OrderCancelled event', async () => {

});

it('ack the message', async () => {

});

- 


`,`expiration-complete-listener.test.ts
---
it("updates the order status to cancelled", async () => {
  const { listener, order, data, msg } = await setup();

  await listener.onMessage(data, msg);

  const updatedOrder = await Order.findById(order.id);
  expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled);
});

it("emit an OrderCancelled event", async () => {
  const { listener, order, data, msg } = await setup();

  await listener.onMessage(data, msg);

  expect(natsWrapper.client.publish).toHaveBeenCalled();

  const eventData = JSON.parse(
    (natsWrapper.client.publish as jest.Mock).mock.calls[0][1]
  );
  expect(eventData.id).toEqual(order.id);
});

it("ack the message", async () => {
  const { listener, data, msg } = await setup();

  await listener.onMessage(data, msg);

  expect(msg.ack).toHaveBeenCalled();
});

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20166.png")`,
    
      ], [
        `# Added the Expiration Complete Listener in index.ts

- new ExpirationCompleteListener(natsWrapper.client).listen();
`,`orders/src/index.ts
---

    new TicketCreatedListener(natsWrapper.client).listen();
    new TicketUpdatedListener(natsWrapper.client).listen();
    new ExpirationCompleteListener(natsWrapper.client).listen();


---`,
    
      ], [
        `# Do not cancel Completed Orders

- 
`,`expiration-complete-listener.ts
---
  async onMessage(
    data: ExpirationCompleteEvent["data"],
    msg: Message
  ) {
    const order = await Order.findById(data.orderId).populate(
      "ticket"
    );

    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status === OrderStatus.Complete) {
      return msg.ack(); // Do not cancel Completed Orders
    }

    order.set({
      status: OrderStatus.Cancelled,
      // ticket: null // ticket id/info could be used later if needed
    });
---`,
    
      ], [
        `# The Payment Service

- Payments service needs to know there is a new order 
  that a user might submit a payment for

- Payments should know that any incoming payments for this order should be rejected

- Orders service needs to know that an order has been paid for


`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20169.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20167.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20168.png")`,
    
      ], [
        `# Payments Service Setup / Microservice Setup / Service Setup

- mkdir payments

- cp tickets/ .dockerignore Dockerfile package.json tsconfig.json payments/

- mkdir payments/src

- cp tickets/src  __mocks__  test apps.ts index.ts nats-wrapper  payments/src
- Updates : 
  - app.ts - delete routers imports & app.use routers 
  - index.ts - delete Listeners imports & new Listener .listen()
  - package.json - "name": "payments"

- Install Dependencies / npm install

- build Docker image
  $ payments % docker build -t stefian22/payments .
  $ payments % docker push stefian22/payments 

- Add config for k8s new service / payments + mongodb pod
  - replace all tickets => payments / payments-depl.yaml
    cp tickets-depl.yaml payments-depl.yaml && sed -i -- "s/tickets/payments/g" payments-depl.yaml
  - replace all tickets => payments / payments-mongo-depl.yaml
    cp tickets-mongo-depl.yaml payments-mongo-depl.yaml && sed -i -- "s/tickets/payments/g" payments-mongo-depl.yaml

- Add skaffold artifact / image for payments
      - image: stefian22/payments # or for GCP: us.gcr.io/aibazar-dev/payments
      context: payments
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: "src/**/*.ts"
            dest: .

`,`
---
SI 9:45:47 $ market % kp                                                   (master)market
kubectl get pods
NAME                                    READY   STATUS    RESTARTS   AGE
auth-depl-66795b6f97-l4x5b              1/1     Running   0          5m1s
auth-mongo-depl-598cc5d7cb-gptbv        1/1     Running   0          5m1s
client-depl-78875c799-p4795             1/1     Running   0          5m1s
expiration-depl-7f564b945c-hr725        1/1     Running   0          5m1s
expiration-redis-depl-9d994b795-5frtr   1/1     Running   0          5m1s
nats-depl-5f5c686b74-nw5dm              1/1     Running   0          5m
orders-depl-77f68fd974-nzc5l            1/1     Running   0          5m
orders-mongo-depl-659b774578-9whlv      1/1     Running   0          5m
payments-depl-7646dcd57-dftv5           1/1     Running   0          5m
payments-mongo-depl-76b4f5c8-2s9wr      1/1     Running   0          5m
tickets-depl-67bff8c7d8-vb78j           1/1     Running   0          4m59s
tickets-mongo-depl-66bffb87c6-5jmsq     1/1     Running   0          4m59s
---`,`
---
[payments-depl-7646dcd57-dftv5 payments] [INFO] 12:42:42 Restarting: /app/src/app.ts has been modified
[payments-depl-7646dcd57-dftv5 payments] Using ts-node version 8.10.2, typescript version 3.9.7
[payments-depl-7646dcd57-dftv5 payments] Connected to NATS
[payments-depl-7646dcd57-dftv5 payments] Connected to MongoDB
[payments-depl-7646dcd57-dftv5 payments] Tickets: Listening on port 3000!
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20170.png")`,
    
      ], [
        
      ], [
        
      ]

    ],
    [
      [
        `# Time for Listeners!

- Inside Orders Service we need to build at least 2 listeners: for << to code 1st
  - ticket:created
  - ticket:updated

- Tickets Service needs to listen for :
  - order:created
  - order:cancelled

- Implement a version field in the tickets service !!
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2077.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2076.png")`,
    
      ], [
        `# Listener Creation

- extending the base-listener class from the common library
`,`
---

---`,
    
      ], [
        `# Blueprint for Listeners

- 
`,`orders/src/events/listeners/ticket-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketCreatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";

export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
  readonly subject = Subjects.TicketCreated;
  queueGroupName = 'orders-service';

  onMessage(data: TicketCreatedEvent['data'], msg: Message) {

  }
}

---`,
    
      ], [
        `# Reminders on queueGroupName, data and msg in Listeners

- Events in a channel will be sent to only one of the queueGroup listeners / service

- To avoid typos, etc on queue group names, we should define then once :

export const queueGroupName = "orders-service";

import { queueGroupName } from "./queue-group-name";

- we call ack(): void; - when we successfully processed a message / event !

- when ack() is not called => msg will be re-distribuited


`,`/@w3ai/common/build/events/ticket-created-event.d.ts
---
import { Subjects } from "./subjects";
export interface TicketCreatedEvent {
    subject: Subjects.TicketCreated;
    data: {
        id: string;
        title: string;
        price: number;
        userId: string;
    };
}

---`,`listeners/queue-group-name.ts
---
export const queueGroupName = "orders-service";
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2078.png")`,
    
      ], [
        `# Testing Job Processing Manually / Postman

- with Postman
  - Create ticket
  - Create order
  - we should see immediately from expiration service the console log:
  I want to publish an expiration:complete event for orderId

- Yey - it works!

- Next: add a Delay in Expiration listener

`,`Watching for changes...
[expiration-depl-7446df4d86-xd2rf expiration] [INFO] 11:27:41 Restarting: /app/src/index.ts has been modified
[expiration-depl-7446df4d86-xd2rf expiration] NATS connection closed!
[expiration-depl-7446df4d86-xd2rf expiration] Using ts-node version 8.10.2, typescript version 3.9.7
[expiration-depl-7446df4d86-xd2rf expiration] Connected to NATS
[orders-depl-9b8999669-7qp2n orders] Message received: ticket:created / orders-service
[tickets-depl-5c55dc956b-njnb8 tickets] Event published to subject ticket:created
[orders-depl-9b8999669-7qp2n orders] Event published to subject order:created
[tickets-depl-5c55dc956b-njnb8 tickets] Message received: order:created / tickets-service
[expiration-depl-7446df4d86-xd2rf expiration] Message received: order:created / expiration-service
[expiration-depl-7446df4d86-xd2rf expiration] I want to publish an expiration:complete event for orderId 5f118f2accd83b001a844773
[tickets-depl-5c55dc956b-njnb8 tickets] Event published to subject ticket:updated
[orders-depl-9b8999669-7qp2n orders] Message received: ticket:updated / orders-service`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20157.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20156.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20155.png")`,`
---

---`,
    
      ], [
        `# Delaying Job Processing

- testing first with a 10 seconds delay:

delay: 10000, // 10 seconds


  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {
    const delay =
      new Date(data.expiresAt).getTime() - new Date().getTime(); // the delay time in miliseconds
    console.log(
      "Waiting this may miliseconds to process the job",
      delay
    );

    await expirationQueue.add(
      {
        orderId: data.id,
      },
      {
        delay, // the delay in millisecond calculated above
      }
    );

    msg.ack();
  }
}
`,`order-created-listener.ts
---
import { Listener, OrderCreatedEvent, Subjects } from "@w3ai/common";
import { Message } from "node-nats-streaming";
import { queueGroupName } from "./queue-group-name";
import { expirationQueue } from "../../queues/expiration-queue";

export class OrderCreatedListener extends Listener<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {
    await expirationQueue.add(
      {
        orderId: data.id,
      },
      {
        delay: 10000, // 10 seconds
      }
    );

    msg.ack();
  }
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20158.png")`,
    
      ], [
        `# Defining the Expiration Complete Event

- Adding to common module a definition for Expiration Complete Event

- we only need to include in data : the orderId

1 - add event to Subjects :

  ExpirationComplete = "expiration:complete",

2 - Add event file : 

  common/src/events/expiration-complete-event.ts

3 - Add Event export in common/ index.ts

  export * from "./events/expiration-complete-event";

- $ common % npm run pub

- $ expiration % npm update @w3ai/common  
`,`expiration-complete-event.ts
---
import { Subjects } from "./subjects";

export interface ExpirationCompleteEvent {
  subject: Subjects.ExpirationComplete;
  data: {
    orderId: string;
  };
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20153.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20159.png")`,
    
      ], [
        `# Publishing an Event on Job Processing

- 
`,`queues/expiration-queue.ts
---
import Queue from "bull";
import { ExpirationCompletePublisher } from "../events/publishers/expiration-complete-publisher";
import { natsWrapper } from "../nats-wrapper";

// Describes Data to be stored inside a Job
interface Payload {
  orderId: string;
}

const expirationQueue = new Queue<Payload>("order:expiration", {
  redis: {
    host: process.env.REDIS_HOST,
  },
});

expirationQueue.process(async (job) => {
  new ExpirationCompletePublisher(natsWrapper.client).publish({
    orderId: job.data.orderId,
  });
});

export { expirationQueue };

---`,
    
      ], [
        `# Handling an Expiration Event in Orders Service

- Orders service needs to know that an order has gone over the 15 minute time limit.  
It is up to the orders service to decide whether or not to cancel the order 
(it might have already been paid!!!)

- $ orders % npm update @w3ai/common  

- `,`orders/src/events/listeners/expiration-complete-listener.ts
---
import {
  Listener,
  Subjects,
  ExpirationCompleteEvent,
  OrderStatus,
} from "@w3ai/common";
import { Message } from "node-nats-streaming";
import { queueGroupName } from "./queue-group-name";
import { Order } from "../../models/order";

export class ExpirationCompleteListener extends Listener<
  ExpirationCompleteEvent
> {
  readonly subject = Subjects.ExpirationComplete;
  queueGroupName = queueGroupName;

  async onMessage(
    data: ExpirationCompleteEvent["data"],
    msg: Message
  ) {
    const order = await Order.findById(data.orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    order.set({
      status: OrderStatus.Cancelled,
      ticket: null,
    });
  }
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20161.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20163.png")`,
    
      ], [
        `# Emiting the Order Cancelled Event 

- 
`,`expiration-complete-listener.ts
---
  async onMessage(
    data: ExpirationCompleteEvent["data"],
    msg: Message
  ) {
    const order = await Order.findById(data.orderId).populate(
      "ticket"
    );

    if (!order) {
      throw new Error("Order not found");
    }

    order.set({
      status: OrderStatus.Cancelled,
      // ticket: null // ticket id/info could be used later if needed
    });
    await order.save();
    await new OrderCancelledPublisher(this.client).publish({
      id: order.id,
      version: order.version,
      ticket: {
        id: order.ticket.id,
      },
    });

    msg.ack();
  }

---`,
    
      ]

    ],
    [
      [
        `# onMessage Implementation

- Data replication between services : - saving ticket  inside the Orders db

    const ticket = Ticket.build({
      title,
      price,
    });
    await ticket.save();
`,`ticket-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketCreatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketCreatedListener extends Listener<
  TicketCreatedEvent
> {
  readonly subject = Subjects.TicketCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketCreatedEvent["data"], msg: Message) {
    const { title, price } = data;
    const ticket = Ticket.build({
      title,
      price,
    });
    await ticket.save();

    msg.ack();
  }
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2079.png")`,
    
      ], [
        `# ID Adjustment

- Need to ensure Tickets in Orders service have the same ID as in the Tickets Service

- Technical debt - changes to Ticket attributes need manual update of attrs in 
  orders /src/models/ticket.ts : 

ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket({
    _id: attrs.id,
    title: attrs.title,
    price: attrs.price
  });
};


`,`
---
ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket({
    _id: attrs.id,
    title: attrs.title,
    price: attrs.price
  });
};
---`,
    
      ], [
        `# Implementing Ticket Updated Listener

- 
`,`orders/src/events/listeners/ticket-updated-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketUpdatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketUpdatedListener extends Listener<
  TicketUpdatedEvent
> {
  readonly subject = Subjects.TicketUpdated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketUpdatedEvent["data"], msg: Message) {
    const ticket = await Ticket.findById(data.id);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const { title, price } = data;
    ticket.set({ title, price });
    await ticket.save();

    msg.ack();
  }
}

---`,
    
      ], [
        `# Initializing the Listeners

- inside orders/src/index.ts
`,`orders/src/index.ts
---
    new TicketCreatedListener(natsWrapper.client).listen();
    new TicketUpdatedListener(natsWrapper.client).listen();

---`,
    
      ], [
        `# Testing the Ticket Listeners within Orders service with Postman

- 
`,`kubectl
---
[orders-depl-6c8d749dd8-twkhx orders] Connected to NATS
[orders-depl-6c8d749dd8-twkhx orders] Connected to MongoDB
[orders-depl-6c8d749dd8-twkhx orders] Orders: Listening on port 3000!
[orders-depl-6c8d749dd8-twkhx orders] Message received: ticket:created / orders-service
[tickets-depl-85ff5b75c5-zbrh9 tickets] Event published to subject ticket:created
[tickets-depl-85ff5b75c5-zbrh9 tickets] Event published to subject ticket:updated
[orders-depl-6c8d749dd8-twkhx orders] Message received: ticket:updated / orders-service
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2085.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2084.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2083.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2082.png")`,
    
      ], [
        `# File Sync Setup in Skaffold for Expiration

- 
`,`skaffold.yaml
---
    - image: stefian22/expiration # or for GCP: us.gcr.io/aibazar-dev/expiration
      context: expiration
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: "src/**/*.ts"
            dest: .
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20150.png")`,`Watching for changes...
[expiration-depl-7446df4d86-xd2rf expiration]
[expiration-depl-7446df4d86-xd2rf expiration] > expiration@1.0.0 start /app
[expiration-depl-7446df4d86-xd2rf expiration] > ts-node-dev --poll src/index.ts
[expiration-depl-7446df4d86-xd2rf expiration]
[expiration-depl-7446df4d86-xd2rf expiration] Using ts-node version 8.10.2, typescript version 3.9.7
[tickets-depl-5c55dc956b-njnb8 tickets]
[tickets-depl-5c55dc956b-njnb8 tickets] > tickets@1.0.0 start /app
[tickets-depl-5c55dc956b-njnb8 tickets] > ts-node-dev --poll src/index.ts
[tickets-depl-5c55dc956b-njnb8 tickets]
[tickets-depl-5c55dc956b-njnb8 tickets] Using ts-node version 8.10.2, typescript version 3.9.7
[client-depl-5979685985-h8tzc client]
[client-depl-5979685985-h8tzc client] > client@1.0.0 dev /app
[client-depl-5979685985-h8tzc client] > next
[client-depl-5979685985-h8tzc client]
[client-depl-5979685985-h8tzc client] ready - started server on http://localhost:3000
[auth-depl-7cfc89b7ff-7rhhv auth]
[auth-depl-7cfc89b7ff-7rhhv auth] > auth@1.0.0 start /app
[auth-depl-7cfc89b7ff-7rhhv auth] > ts-node-dev --poll src/index.ts
[auth-depl-7cfc89b7ff-7rhhv auth]
[auth-depl-7cfc89b7ff-7rhhv auth] Using ts-node version 8.10.2, typescript version 3.9.5
[orders-depl-9b8999669-7qp2n orders]
[orders-depl-9b8999669-7qp2n orders] > orders@1.0.0 start /app
[orders-depl-9b8999669-7qp2n orders] > ts-node-dev --poll src/index.ts
[orders-depl-9b8999669-7qp2n orders]
[orders-depl-9b8999669-7qp2n orders] Using ts-node version 8.10.2, typescript version 3.9.7
[client-depl-5979685985-h8tzc client] > Using "webpackDevMiddleware" config function defined in next.config.js.
[expiration-depl-7446df4d86-xd2rf expiration] Connected to NATS
[tickets-depl-5c55dc956b-njnb8 tickets] Connected to NATS
[tickets-depl-5c55dc956b-njnb8 tickets] Connected to MongoDB
[tickets-depl-5c55dc956b-njnb8 tickets] Tickets: Listening on port 3000!
[orders-depl-9b8999669-7qp2n orders] Connected to NATS
[orders-depl-9b8999669-7qp2n orders] Connected to MongoDB
[orders-depl-9b8999669-7qp2n orders] Orders: Listening on port 3000!
[auth-depl-7cfc89b7ff-7rhhv auth] Connected to MongoDB
[auth-depl-7cfc89b7ff-7rhhv auth] Auth: Listening on port 3000!
[client-depl-5979685985-h8tzc client] event - compiled successfully
[client-depl-5979685985-h8tzc client] wait  - compiling...
[client-depl-5979685985-h8tzc client] Attention: Next.js now collects completely anonymous telemetry regarding usage.
[client-depl-5979685985-h8tzc client] This information is used to shape Next.js' roadmap and prioritize features.
[client-depl-5979685985-h8tzc client] You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
[client-depl-5979685985-h8tzc client] https://nextjs.org/telemetry
[client-depl-5979685985-h8tzc client]
[client-depl-5979685985-h8tzc client] event - compiled successfully`,
    
      ], [
        `# Listener Creation

- 
`,`expiration/src/events/listeners/order-created-listener.ts
---
import { Listener, OrderCreatedEvent, Subjects } from '@w3ai/common';
import { Message } from 'node-nats-streaming';
import { queueGroupName } from './queue-group-name';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent['data'], msg: Message) {

  }
}
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20149.png")`,
    
      ], [
        `# Bull JS

- Traditional Bull use : 
  - Bull is handling the entire process / on the Web Server  and Worker Servers
  - Bull is designed for 1 off little jobs
  - Not for handling a huge nr of messages like NATS it is built for

- Terms :
  - Queue - Series of messages that we want to queue up and process over time

- In our case we don't have separate Web and Worker servers
  - everything is containe in our Expiration service

-  And we separate Expiration and Redis on diff pods 
  => they should not get down at same time`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20153.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20152.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20151.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20149.png")`,
    
      ], [
        `# Creating a queue in Expiration Service / Bull JS

- Jobs are like an Event in NATS

- Job type / description like a NATS Channel

- use Queue class from Bull to produce and process jobs
  - 1st param ~ channel name = Bucket inside Redis that we want to store 
  the jobs in temporarely

- Job - simmilar to the Message from NATS 
  - a wrapper

- `,`expiration-queue.ts
---
import Queue from "bull";

// Describes Data to be stored inside a Job
interface Payload {
  orderId: string;
}

const expirationQueue = new Queue<Payload>("order:expiration", {
  redis: {
    host: process.env.REDIS_HOST,
  },
});

expirationQueue.process(async (job) => {
  console.log(
    "I want to publish an expiration:complete event for orderId",
    job.data.orderId
  );
});

export { expirationQueue };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20153.png")`,
    
      ], [
        `# Queueing a job on event arrival

- initially will wire things without the delay of 15mins
  - for testing => we'll imediatelly process the job

- start the listener in index.ts : 
  new OrderCreatedListener(natsWrapper.client).listen();
`,`index.ts
---
import { natsWrapper } from "./nats-wrapper";
import { OrderCreatedListener } from './events/listeners/order-created-listener';

const start = async () => {
  if (!process.env.NATS_CLIENT_ID) {
    throw new Error("NATS_CLIENT_ID must be defined");
  }
  if (!process.env.NATS_URL) {
    throw new Error("NATS_URL must be defined");
  }
  if (!process.env.NATS_CLUSTER_ID) {
    throw new Error("NATS_CLUSTER_ID must be defined");
  }

  try {
    await natsWrapper.connect(
      process.env.NATS_CLUSTER_ID,
      process.env.NATS_CLIENT_ID,
      process.env.NATS_URL
    );
    // capture connection close events
    natsWrapper.client.on("close", () => {
      console.log("NATS connection closed!");
      process.exit();
    });
    process.on("SIGINT", () => natsWrapper.client.close());
    process.on("SIGTERM", () => natsWrapper.client.close());

    new OrderCreatedListener(natsWrapper.client).listen();
  } catch (err) {
    console.error(err);
  }
};

start();

---`,`order-created-listener.ts
---
import { Listener, OrderCreatedEvent, Subjects } from "@w3ai/common";
import { Message } from "node-nats-streaming";
import { queueGroupName } from "./queue-group-name";
import { expirationQueue } from "../../queues/expiration-queue";

export class OrderCreatedListener extends Listener<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {
    await expirationQueue.add({
      orderId: data.id,
    });

    msg.ack();
  }
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20154.png")`,`Watching for changes...
Syncing 1 files for stefian22/expiration:90a828c2805c5450d131c1002be67cf2a8e9a8a5d4ce0111db00759cc852deab
Watching for changes...
[expiration-depl-7446df4d86-xd2rf expiration] [INFO] 11:27:41 Restarting: /app/src/index.ts has been modified
[expiration-depl-7446df4d86-xd2rf expiration] NATS connection closed!
[expiration-depl-7446df4d86-xd2rf expiration] Using ts-node version 8.10.2, typescript version 3.9.7
[expiration-depl-7446df4d86-xd2rf expiration] Connected to NATS`,
    
      ]

    ],
    [
      [
        `# Concurrency Issues

- Concurrency test script creating and updating 200 tickets in parallel
- 4 Orders listeners will update the Orders Tickets DB
- 4 copies of the Tickets Services

- Tickets service DB will have consistent data 
  => 200 tickets with a price of 15 (5 => 10 => 15)

- We want the Orders tickets db to be consistent with the Tickets service DB

-  Occasionally the updates / messages will be processed out of order => 
  5 > 15 > 10 ==>> inconsistent / out of order

- => Concurrency issue => not matching the Titckets DB

- 2 Mongo Shell /  Tickets DB / Orders DB
  db.tickets.find({})
  db.tickets.remove({})
  db.tickets.find({ price: 10 }).length() // in Tickets DB = 0
  db.tickets.find({ price: 10 }).length() // in Orders DB = 1,3, 10


- Solution - > Need to ensure Events are processed in the Correct Order !!`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2089.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2088.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2087.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2086.png")`,
    
      ], [
        `# Versioning Records

- Adding a version attribute for the record / ticket

- Any time we update a record / ticket we increment the version number !!

- By not calling the ack() function in the onMessage() 
  we can force processing in order of the messages / events 
  based on the version of the data of the record

- Out of order event will be re-emitted after 5 seconds by NATS 

- During those 5 secs eventually the correct sequence / next version message will
  be processed

- Need to manage the version flag in the dbs 

- But Mongo and Mongoose can manage the versioning for us !!!

- We'll have to include a version flag in the tickets / record data structure !!
  => update of the common module !!
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2090.png")`,
    
      ], [
        `# Optimistic Concurrency Control - OCC

- The process is known as Optimistic Concurrency Control
  - not a Mongo / mongoose specific strategy
  - implemented by may dbs

- mongoose updates the version field of the document automatically

- internally mongoose will ask mongo to find the record with the ID & version of 1 / v
 => select the record with the right version

- Process is specific for for updating records

- Record creation process will default to version of 0 or 1

- 
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2092.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2091.png")`,
    
      ], [
        `# Mongoose Update-If-Current

- mongoose-update-if-current
https://www.npmjs.com/package/mongoose-update-if-current
Optimistic concurrency control plugin for Mongoose v5.0 and higher.

This plugin brings optimistic concurrency control to Mongoose documents by 
incrementing document version numbers on each save, and preventing previous 
versions of a document from being saved over the current version.
options: version or timestamp
Inspired by issue #4004 in the Mongoose GitHub repository.

Installation
$ npm install --save mongoose
$ npm install --save mongoose-update-if-current

- we will not use the default mongo __v but will rename to version

$ tickets % npm install mongoose-update-if-current 

`,`
---

---`,`Default behaviour is to use the schema's version key (__v by default) to implement concurrency control. The plugin can be configured to use timestamps (updatedAt by default) instead, if they are enabled on the schema:

/* Global plugin - remember to add { timestamps: true } to each schema */
mongoose.plugin(updateIfCurrentPlugin, { strategy: 'timestamp' });
 
/* Single schema */
const mySchema = new mongoose.Schema({ ... }, { timestamps: true });
mySchema.plugin(updateIfCurrentPlugin, { strategy: 'timestamp' });
The plugin will hook into the save() function on schema documents to increment the version and check that it matches the version in the database before persisting it`,
    
      ], [
        `# Implementig OCC with Mongoose in tickets service

import { updateIfCurrentPlugin } from 'mongoose-update-if-current';


- Defining / Renaming __v to version :

ticketSchema.set('versionKey', 'version');
ticketSchema.plugin(updateIfCurrentPlugin);

- GOGITO : beside version to define a branch attribute for 
  services (tickets) and projects (orders)

- 
`,`ticket/src/models/ticket.ts
---

import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface TicketDoc extends mongoose.Document {
  // gives option to add properties in the future
  title: string;
  price: number;
  userId: string;
  version: number;
}

ticketSchema.set("versionKey", "version");
ticketSchema.plugin(updateIfCurrentPlugin);

---`,`models/__test__/ticket.test.ts
---
import { Ticket } from "../ticket";

it("implements optimistic concurrency control", async () => {});

---`,
    
      ], [
        `# Testing OCC

- $ tickets % npm run test
`,`ticket.test.ts
---
import { Ticket } from "../ticket";

it("implements optimistic concurrency control", async (done) => {
  // Create an instance of a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 5,
    userId: "123",
  });

  // Save the ticket to the database
  await ticket.save();

  // Fetch the ticket twice
  const firstInstance = await Ticket.findById(ticket.id);
  const secondInstance = await Ticket.findById(ticket.id);

  // make two separate changes to the tickets
  firstInstance!.set({ price: 10 });
  secondInstance!.set({ price: 15 });

  // save the first fetched ticket
  await firstInstance!.save();

  // save the second fetched ticket and expect an error - due to an outdated version property
  try {
    await secondInstance!.save();
  } catch (err) {
    return done();
  }

  throw new Error("Should not reach this point");
});


---`,`
---
import { Ticket } from "../ticket";

it("implements optimistic concurrency control", async () => {
  // Create an instance of a ticket

  // Save the ticket to the database

  // Fetch the ticket twice

  // make two separate changes to the tickets

  // save the first fetched ticket

  // save the second fetched ticket and expect an error
  // - will have an outdated version nr

});

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2094.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2093.png")`,
    
      ], [
        `# The Expiration Service

- Watch / listen for order:created

- Expiration service needs to start a 15 minute timer to eventually time out this order

- After 15min - publish an event / msg : expiration:complete - after 15 mins

- Orders service needs to know that an order has gone over the 15 minute time limit.  
It is up to the orders service to decide whether or not to cancel the order 
(it might have already been paid!!!)

- Expiration service is just a 15 min timer - 
  - not announcing an order being cancelled - this is Orders service job

- 4 options to implement the timer to analyze next
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20141.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20140.png")`,
    
      ], [
        `# How to Implement a timer for the Expiration Service

- Waiting 15 mins = Emitting the expiration:complete event when 
  order created time is 15 mins in the past !!

- Option 1 - setTimeout(() => ... 15mins ) every time we get the order created event !!
   - Timer stored in memory => If service restarts, all timers are lost.

- Option 2 - Rely on NATS redelivery mechanism
  - with no ack - NATS will re-emit the order created after 5 sec
  - when order created is in the past we can ack the message and send exp complete
  - Downside: for logging purposes we want to track nr of re-deliveries
    => Using this mechanism for both logging / maint. and business logic 
    => Confusing Ops & Business
    - Doesn't feel right => Complications later

- Option 3 - Message Broker / Scheduler to delay expiration complete msg for 15mins
  - NOT supported by NATS (now) - scheduled message / event
  - immediatelly publish exp:complete with additional instructions for Event Bus / Broker
    to delay publishing for 15mins

- Option 4 - Bull JS / Redis Server << We'll implement this !!!
  - Bull JS library - to set long lived timers / schedule tasks
  - When order:created use Bull JS to remind us to do something / emit exp complete
    in 15 mins 
  - Bull JS will store a reminder inside a Redis instance 
  - Redis is an in mem database commonly used for tasks like this
  - Bull will store in Redis a list of jobs / tasks scheduled to be done at some time
  - after 15 mins - Bull will get a reminder from Redis that needs to do something
  - Bull will announce Exp Service that 15mins are elapsed and shoud send 
    exp:complete
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20149.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20148.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20147.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20146.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20145.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20144.png")`,
    
      ], [
        `# Setup Bull JS and Redis inside the Kubernetes cluster
- Bull JS - job processing manager

- copy base service files from tickets service :
  Dockerfile, .dockerignore, package.json, tsconfig.json

- copy tickets/src index, nats-wrapper.ts and __mocks__ to expiration/src

- cleanup dependencies

- $ expiration % npm install bull @types/bull

- $ expiration % npm install 

- cleanup index.ts

- 
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20149.png")`,
    
      ], [
        `# Kubernetes Setup

- $ expiration % docker build -t stefian22/expiration .

- $ expiration % docker push stefian22/expiration

- create expiration-redis-depl ~ auth-mongo-depl
and 
expiration-depl ~ tickets-depl
`,`expiration-depl.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: expiration-depl
spec:
  replicas: 1
  selector:
    matchLabels:
      app: expiration
  template:
    metadata:
      labels:
        app: expiration
    spec:
      containers:
        - name: expiration
          image: stefian22/expiration # image: us.gcr.io/aibazar-dev/expiration
          env:
            - name: NATS_CLIENT_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: NATS_URL
              value: "http://nats-srv:4222"
            - name: NATS_CLUSTER_ID
              value: aibazar
            - name: REDIS_HOST
              value: expiration-redis-srv

---`,`expiration-redis-depl.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: expiration-redis-depl
spec:
  replicas: 1
  selector:
    matchLabels:
      app: expiration-redis
  template:
    metadata:
      labels:
        app: expiration-redis
    spec:
      containers:
        - name: expiration-redis
          image: redis
---
apiVersion: v1
kind: Service
metadata:
  name: expiration-redis-srv
spec:
  selector:
    app: expiration-redis
  ports:
    - name: db
      protocol: TCP
      port: 6379 # default listening port for redis
      targetPort: 6379

---`,`
---
SI 22:40:22 $ market % kp                                                             (master)market
kubectl get pods
NAME                                     READY   STATUS    RESTARTS   AGE
auth-depl-7d54c499bc-4lddg               1/1     Running   0          2m40s
auth-mongo-depl-549749c754-9whp7         1/1     Running   0          2m40s
client-depl-56844d85d9-rg2rb             1/1     Running   0          2m40s
expiration-depl-757f8fb7fb-l6g6x         1/1     Running   0          2m40s
expiration-redis-depl-768c9cdfbf-cwxv2   1/1     Running   0          2m40s
nats-depl-7d74ff8c64-m4tt9               1/1     Running   0          2m39s
orders-depl-9fbffd865-zkmvt              1/1     Running   0          2m39s
orders-mongo-depl-56f499456-fwk9q        1/1     Running   0          2m39s
tickets-depl-5d9b44c966-ph2nc            1/1     Running   0          2m39s
tickets-mongo-depl-77b4978f98-w79qb      1/1     Running   0          2m38s
---`,
    
      ]

    ],
    [
      [
        `# Testing version increments on multiple saves

- 
`,`ticket.test.ts
---
it("increments the version number on multiple saves", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
    userId: "123",
  });

  await ticket.save();
  expect(ticket.version).toEqual(0);
  await ticket.save();
  expect(ticket.version).toEqual(1);
  await ticket.save();
  expect(ticket.version).toEqual(2);
});

---`,
    
      ], [
        `# Adding version to common event messages

- When should we increment or include the 'version' number of a record with an event? 

- Increment the 'version' number whenever the
  primary service responsible for a record 
  emits an event to describe a create/update/destroy to a record


`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2096.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2095.png")`,
    
      ], [
        `# Adding version: number to the 4 Events in Common module

- $ common % npm run pub 

- $ orders % npm update @w3ai/common

- $ tickets % npm update @w3ai/common


`,`$ common % npm run pub
---
npm notice === Tarball Details === 
npm notice name:          @w3ai/common                            
npm notice version:       1.0.9                                   
npm notice package size:  5.2 kB                                  
npm notice unpacked size: 21.8 kB                                 
npm notice shasum:        9148bc8d9c4b130cc7cc16fbeb8fc4267c11cbed
npm notice integrity:     sha512-mgceYHjvmh2Gt[...]lVFbdJ0U6MVtw==
npm notice total files:   39                                      
npm notice 
+ @w3ai/common@1.0.9
---`,
    
      ], [
        `# Updating Tickets Event Definitions

- version: ticket.version,
`,`new.ts
---
    await new TicketCreatedPublisher(natsWrapper.client).publish({
      id: ticket.id,
      title: ticket.title,
      price: ticket.price,
      userId: ticket.userId,
      version: ticket.version,
    });
---`,`update.ts
---
    new TicketUpdatedPublisher(natsWrapper.client).publish({
      id: ticket.id,
      title: ticket.title,
      price: ticket.price,
      userId: ticket.userId,
      version: ticket.version,
    });
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2097.png")`,
    
      ], [
        `# Publishing While Listening

- Changes in base listener and publisher : 
protected client: Stan;

in ticket created / updated event :
orderId?: string;

npm run pub >> v1.0.10

$ tickets % npm update @w3ai/common  

- Cmd + Shift + P / Reload window if ts error on this.client
  - this will reboot the TS type checker !!

- 

`,`order-created-listener.ts
---
    // Save the  ticket and publish a TicketUpdated message
    await ticket.save();
    await new TicketUpdatedPublisher(this.client).publish({
      id: ticket.id,
      price: ticket.price,
      title: ticket.title,
      userId: ticket.userId,
      orderId: ticket.orderId,
      version: ticket.version,
    });

    // ack the message
    msg.ack();
---`,
    
      ], [
        `# Mock Function Arguments

-   Get TS access to mock functions
  (natsWrapper.client.publish as jest.Mock).mock.calls[0][1];

- `,`tickets/src/events/listeners/__test__/order-created-listener.test.ts
---
it("publishes a ticket updated event", async () => {
  const { listener, ticket, data, msg } = await setup();

  await listener.onMessage(data, msg);

  expect(natsWrapper.client.publish).toHaveBeenCalled();

  // Get TS access to mock functions
  const ticketUpdatedData = JSON.parse(
    (natsWrapper.client.publish as jest.Mock).mock.calls[0][1]
  );

  expect(data.id).toEqual(ticketUpdatedData.orderId);

  // @ts-ignore
  // console.log(natsWrapper.client.publish.mock.calls[0][1]);
  // console.log(natsWrapper.client.publish.mock.calls);
});
---`,
    
      ], [
        `# Order Cancelled Listener

- Tickets service should unreserve a ticket if the corresponding order 
  has been cancelled so this ticket can be edited again

- Payments should know that any incoming payments for this order should be rejected

- 
`,`order-cancelled-listener.ts
---
import {
  Listener,
  OrderCancelledEvent,
  Subjects,
} from "@w3ai/common";
import { Message } from "node-nats-streaming";
import { queueGroupName } from "./queue-group-name";
import { Ticket } from "../../models/ticket";
import { TicketUpdatedPublisher } from "../publishers/ticket-updated-publisher";

export class OrderCancelledListener extends Listener<
  OrderCancelledEvent
> {
  readonly subject = Subjects.OrderCancelled;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCancelledEvent["data"], msg: Message) {
    const ticket = await Ticket.findById(data.ticket.id);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    ticket.set({ orderId: undefined });
    await ticket.save();
    await new TicketUpdatedPublisher(this.client).publish({
      id: ticket.id,
      orderId: ticket.orderId,
      userId: ticket.userId,
      price: ticket.price,
      title: ticket.title,
      version: ticket.version,
    });

    msg.ack();
  }
}

---`,`order-cancelled-listener.ts
---
import {
  Listener,
  OrderCancelledEvent,
  Subjects,
} from "@w3ai/common";
import { Message } from "node-nats-streaming";
import { queueGroupName } from "./queue-group-name";

export class OrderCancelledListener extends Listener<
  OrderCancelledEvent
> {
  readonly subject = Subjects.OrderCancelled;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCancelledEvent["data"], msg: Message) {}
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20138.png")`,
    
      ], [
        `# Test for the order-cancelled-listener

- 
`,`order-cancelled-listener.test.ts
---
it("updates the ticket, publishes an event, and acks the message", async () => {
  const { msg, data, ticket, orderId, listener } = await setup();

  await listener.onMessage(data, msg);

  const updatedTicket = await Ticket.findById(ticket.id);

  expect(updatedTicket!.orderId).not.toBeDefined();
  expect(msg.ack).toHaveBeenCalled();
  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
---`,`order-cancelled-listener.test.ts
---
import mongoose from "mongoose";
import { Message } from "node-nats-streaming";
import { OrderCancelledEvent } from "@w3ai/common";
import { OrderCancelledListener } from "../order-cancelled-listener";
import { natsWrapper } from "../../../nats-wrapper";
import { Ticket } from "../../../models/ticket";

const setup = async () => {
  const listener = new OrderCancelledListener(natsWrapper.client);

  const orderId = mongoose.Types.ObjectId().toHexString();
  const ticket = Ticket.build({
    title: "service",
    price: 20,
    userId: "asdf",
  });
  ticket.set({ orderId });
  await ticket.save();

  const data: OrderCancelledEvent["data"] = {
    id: orderId,
    version: 0,
    ticket: {
      id: ticket.id,
    },
  };

  // @ts-ignore
  const msg: Message = {
    ack: jest.fn(),
  };

  return { msg, data, ticket, orderId, listener };
};
---`,
    
      ], [
        `# Calling the listeners in tickets/src/index.ts

- initialize and start the listeners on the tickets service

- 
`,`tickets/src/index.ts
---
    new OrderCreatedListener(natsWrapper.client).listen();
    new OrderCancelledListener(natsWrapper.client).listen();

---`,
    
      ], [
        `# Rejecting Editd of Reserved Tickets

- Must be tested as this is critical business logic !!


`,`update.test.ts
---
it("reject updates if the ticket is reserved", async () => {
  const cookie = global.signin();

  const response = await request(app)
    .post("/api/tickets")
    .set("Cookie", cookie)
    .send({
      title: "asldkfj",
      price: 20,
    });

  const ticket = await Ticket.findById(response.body.id);
  ticket!.set({ orderId: mongoose.Types.ObjectId().toHexString() });
  await ticket!.save();

  await request(app)
    .put(\`/api/tickets/\${response.body.id}\`)
    .set("Cookie", cookie)
    .send({
      title: "new title",
      price: 100,
    })
    .expect(400);
});
---`,`tickets/src/routes/update.ts
---
    if (ticket.orderId) {
      throw new BadRequestError("Cannot edit a reserved ticket");
    }
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20139.png")`,
    
      ]

    ],
    [
      [
        `# Applying a Version Query

- $ orders % npm install mongoose-update-if-current

- added version to the orderSchema - to avoid error in skaffold
`,`ticket-updated-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketUpdatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketUpdatedListener extends Listener<
  TicketUpdatedEvent
> {
  readonly subject = Subjects.TicketUpdated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketUpdatedEvent["data"], msg: Message) {
    const ticket = await Ticket.findOne({
      _id: data.id,
      version: data.version - 1,
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const { title, price } = data;
    ticket.set({ title, price });
    await ticket.save();

    msg.ack();
  }
}

---`,`orders/src/models/ticket.ts
---
ticketSchema.set("versionKey", "version");
ticketSchema.plugin(updateIfCurrentPlugin);
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20100.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2099.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2098.png")`,
    
      ], [
        `# Re-testing Concurrency with 400 parallel updates tickets

- ToDo :  re-enact the parallel concurency test


`,`t/index.ts
---
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');

const cookie =
  'express:sess=eyJqd3QiOiJleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcFpDSTZJalZsT0dZME5qQTFOak5oWVRkbE1EQXlZMkl3TUdSbU5pSXNJbVZ0WVdsc0lqb2lkR1Z6ZERFd1FIUmxjM1F1WTI5dElpd2lhV0YwSWpveE5UZzJOVE0yTlRBMWZRLlh3R3p5UVZHYnFSaHZ1YWJDMTdsYzNtYlpQNU1XMnl1UU1kODU1Y0hEM3MifQ==';

const doRequest = async () => {
  const { data } = await axios.post(
    \`https://ticketing.dev/api/tickets\`,
    { title: 'ticket', price: 5 },
    {
      headers: { cookie },
    }
  );

  await axios.put(
    \`https://ticketing.dev/api/tickets/\${data.id}\`,
    { title: 'ticket', price: 10 },
    {
      headers: { cookie },
    }
  );

  axios.put(
    \`https://ticketing.dev/api/tickets/\${data.id}\`,
    { title: 'ticket', price: 15 },
    {
      headers: { cookie },
    }
  );

  console.log('Request complete');
};

(async () => {
  for (let i = 0; i < 400; i++) {
    doRequest();
  }
})();

---`,`t/package.json
---
{
  "name": "t",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "axios": "^0.19.2"
  }
}

---`,
    
      ], [
        `# Abstracted Ticket Query Method - findByEvent()

- 
`,`orders/src/models/ticket.ts
---
ticketSchema.statics.findByEvent = (event: {
  id: string;
  version: number;
}) => {
  return Ticket.findOne({
    _id: event.id,
    version: event.version - 1,
  });
};
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20102.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20101.png")`,
    
      ], [
        `# Optional - Versioning Without Update-If-Current

- mongoose-update-if-current assumes version / __v starts at 0 and increments by 1

- there might be further situations with other services / dbs where start is at 100 and 
  increments by 100

- or version string that is a timestamp

- Option to manage the versioning by our own code instead of relying on a modulle !!!
  that might not implement / cover all the scenarios we need !!

- This code will be reverted !!! and the solution further will be based on :
  mongoose-update-if-current 

- What mongoose-update-if-current does : 
1 - Updates the version number by 1 on records before they are saved 

    // Versioning WITHOUT NPM module - mongoose-update-if-current
    const { title, price, version } = data;
    ticket.set({ title, price, version });
    await ticket.save();

2 - Customizes the find-and-update operation (save) to look for the correct version

- injecting code in to the save operation :
https://mongoosejs.com/docs/api/model.html#model_Model-$where
- Additional properties to attach to the query when calling save() and isNew is false.
- this is how to overwrite or add additional query props

- $ kubectl exec -it orders-mongo-depl-5bd49b4655-wtxgl mongo


`,`original orders/src/events/listeners/ticket-update-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketUpdatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketUpdatedListener extends Listener<
  TicketUpdatedEvent
> {
  readonly subject = Subjects.TicketUpdated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketUpdatedEvent["data"], msg: Message) {
    const ticket = await Ticket.findByEvent(data);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const { title, price } = data;
    ticket.set({ title, price });
    await ticket.save();

    msg.ack();
  }
}

---`,`orders/src/events/listeners/ticket-update-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketUpdatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketUpdatedListener extends Listener<
  TicketUpdatedEvent
> {
  readonly subject = Subjects.TicketUpdated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketUpdatedEvent["data"], msg: Message) {
    const ticket = await Ticket.findByEvent(data);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Versioning WITHOUT NPM module - mongoose-update-if-current
    const { title, price, version } = data;
    ticket.set({ title, price, version });
    await ticket.save();

    // Versioning with NPM module - mongoose-update-if-current
    // const { title, price } = data;
    // ticket.set({ title, price });
    // await ticket.save();

    msg.ack();
  }
}

---`,`order/src/models/ticket.ts
---
// ticketSchema.plugin(updateIfCurrentPlugin);

// Setting a mongoose pre save hook: // when NOT using the updateIfCurrentPlugin
ticketSchema.pre('save', function (done) {
  // @ts-ignore
  this.$where = {
    // assuming versioning is incremented by 1 on each update
    // to change to 10, 100, etc eg: => version: this.get('version') - 100  
    version: this.get('version') - 1  
  };

  done();
}); // middleware that will run anytime we save() a record
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20118.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20117.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20116.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20115.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20114.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20113.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20112.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20111.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20110.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20108.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20105.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20104.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20103.png")`,
    
      ], [
        `# Testing Listeners

- prepared template for listeners test file
`,`orders/src/events/listeners/ticket-created-listener.ts
---
const setup = async () => {
  // create an instance of the listener

  // create a fake data event

  // create a fake message object
};

it('creates and saves a ticket', async () => {
  // call the onMessage function with the data object + message object

  // write assertions to make sure a ticket was created
});

it('acks the message', async () => {
  // call the onMessage function with the data object + message object

  // write assertions to make sure ack function is called
});
---`,
    
      ], [
        `# A Complete Listener Test

- 
it("creates and saves a ticket", async () => {
  const { listener, data, msg } = await setup();
  // call the onMessage function with the data object + message object
  await listener.onMessage(data, msg);

  // write assertions to make sure a ticket was created
  const ticket = await Ticket.findById(data.id);

  expect(ticket).toBeDefined();
  expect(ticket!.title).toEqual(data.title);
  expect(ticket!.price).toEqual(data.price);
});
`,`ticket-created-listener.test.ts
---
import { Message } from "node-nats-streaming";
import mongoose from "mongoose";
import { TicketCreatedEvent } from "@w3ai/common";
import { TicketCreatedListener } from "../ticket-created-listener";
import { natsWrapper } from "../../../nats-wrapper";
import { Ticket } from "../../../models/ticket";

const setup = async () => {
  // create an instance of the listener
  const listener = new TicketCreatedListener(natsWrapper.client);

  // create a fake data event
  const data: TicketCreatedEvent["data"] = {
    version: 0,
    id: new mongoose.Types.ObjectId().toHexString(),
    title: "service",
    price: 10,
    userId: new mongoose.Types.ObjectId().toHexString(),
  };

  // create a fake message object
  // @ts-ignore
  const msg: Message = {
    ack: jest.fn(), // a jest mock function to keep track of nr calls and params provided
  };

  return { listener, data, msg };
};
---`,`ticket-created-listener.test.ts
---
it("creates and saves a ticket", async () => {
  const { listener, data, msg } = await setup();
  // call the onMessage function with the data object + message object
  await listener.onMessage(data, msg);

  // write assertions to make sure a ticket was created
  const ticket = await Ticket.findById(data.id);

  expect(ticket).toBeDefined();
  expect(ticket!.title).toEqual(data.title);
  expect(ticket!.price).toEqual(data.price);
});
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20119.png")`,
    
      ], [
        `# Testing the Ack call

- 
`,`ticket-created-listener.test.ts
---
it("acks the message", async () => {
  const { listener, data, msg } = await setup();

  // call the onMessage function with the data object + message object
  await listener.onMessage(data, msg);

  // write assertions to make sure ack function is called
  expect(msg.ack).toHaveBeenCalled();
});
---`,`@(shell):1:1
> cls
> show dbs;
admin   0.000GB
config  0.000GB
local   0.000GB
orders  0.000GB
> use orders;
switched to db orders
> db.tickets
orders.tickets
> db.ticket.find({ price: 2000})
> db.tickets.find({ price: 2000})
{ "_id" : ObjectId("5f0dde6cfb38770018e53b76"), "title" : "Video Service", "price" : 2000, "version" : 2 }
> db.tickets.find({ price: 1982.3})
{ "_id" : ObjectId("5f0dde6cfb38770018e53b76"), "title" : "Video Service", "price" : 1982.3, "version" : 3 }
> db.tickets.find({ price: 103.3})
{ "_id" : ObjectId("5f0dde6cfb38770018e53b76"), "title" : "Video Service", "price" : 103.3, "version" : 4 }`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20130.png")`,
    
      ], [
        `# Order-Created-Listener Test Implementation

- it tests : 
it('sets the userId of the ticket', async () => {

});

it('acks the message', async () => {

});
`,`order-created-listener.test.ts
---
it("sets the userId of the ticket", async () => {
  const { listener, ticket, data, msg } = await setup();

  await listener.onMessage(data, msg);

  const updatedTicket = await Ticket.findById(ticket.id);

  expect(updatedTicket!.orderId).toEqual(data.id);
});

it("acks the message", async () => {
  const { listener, ticket, data, msg } = await setup();

  await listener.onMessage(data, msg);

  expect(msg.ack).toHaveBeenCalled();
});
---`,`order-created-listener.test.ts
---
it('sets the userId of the ticket', async () => {

});

it('acks the message', async () => {

});
---`,
    
      ], [
        `# Missing Update Event Test

- Whenever we make Changes to a record (ticket, etc) we have to Emit an Event !!
  - so all dependant services can update their data !!

- Otherwise the records will get out of sync !!`,`order-created-listener.test.ts
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20135.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20134.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20133.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20132.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20131.png")`,
    
      ], [
        `# Publish an event immediatelly after ticket.save()
  - to inform abou the record update

- Need to update the TicketUpdatedPublisher / Event - to include orderId

-  Easy solution but issues later in testing :

  new TicketUpdatedPublisher(natsWrapper.client);

- There is a Private nats client in the base-listener class though !!

- => make the nats client Protected inside the base-listener / common lib

-  
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20137.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20136.png")`,
    
      ]

    ],
    [
      [
        `# Success Case Testing

- 
`,`ticket-updated-listener.test.ts
---
it("finds, updates, and saves a ticket", async () => {
  const { msg, data, ticket, listener } = await setup();

  await listener.onMessage(data, msg);

  const updatedTicket = await Ticket.findById(ticket.id);

  expect(updatedTicket!.title).toEqual(data.title);
  expect(updatedTicket!.price).toEqual(data.price);
  expect(updatedTicket!.version).toEqual(data.version);
});

it("acks the message", async () => {
  const { msg, data, listener } = await setup();

  await listener.onMessage(data, msg);

  expect(msg.ack).toHaveBeenCalled();
});
---`,`ticket-updated-listener.test.ts
---

---`,
    
      ], [
        `# Testing the Ticket Updated Listener 

- 
`,`ticket-updated-listener.test.ts
---
import mongoose from "mongoose";
import { Message } from "node-nats-streaming";
import { TicketUpdatedEvent } from "@w3ai/common";
import { TicketUpdatedListener } from "../ticket-updated-listener";
import { natsWrapper } from "../../../nats-wrapper";
import { Ticket } from "../../../models/ticket";

const setup = async () => {
  // Create a listener
  const listener = new TicketUpdatedListener(natsWrapper.client);

  // Create and save a ticket
  const ticket = Ticket.build({
    id: mongoose.Types.ObjectId().toHexString(),
    title: "service",
    price: 20,
  });
  await ticket.save();

  // Create a fake data object
  const data: TicketUpdatedEvent["data"] = {
    id: ticket.id,
    version: ticket.version + 1,
    title: "new service",
    price: 999,
    userId: "whateverId",
  };

  // Create a fake msg object
  // @ts-ignore
  const msg: Message = {
    ack: jest.fn(),
  };

  // return all of this stuff
  return { msg, data, ticket, listener };
};
---`,`ticket-updated-listener.test.ts
---
const setup = async () => {
  // Create a listener
  // Create and save a ticket
  // Create a fake data object
  // Create a fake msg object
  // return all of this stuff
};

it("finds, updates, and saves a ticket", async () => {});

it("acks the message", async () => {});
---`,
    
      ], [
`# Testing the case of Out-Of-Order Events 

- 
`,`ticket-updated-listener.test.ts
---
it("does not call ack if the event has a skipped version number", async () => {
  const { msg, data, listener, ticket } = await setup();

  data.version = 10;

  try {
    await listener.onMessage(data, msg);
  } catch (err) {}

  expect(msg.ack).not.toHaveBeenCalled();
});
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20120.png")`,
    
      ], [
        `# Next Videos

1 - Add the 'mongoose-update-if-current' module into the Orders model - Done

2 - Fix up some tests - we are creating some Tickets in the Orders service 
  without providing them an ID Next Couple Videos 

3 - Fix up some route handlers - we are publishing events around orders 
  but not providing the version of the order


`,`models/order.ts
---
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface OrderDoc extends mongoose.Document {
  userId: string;
  status: OrderStatus;
  expiresAt: Date;
  ticket: TicketDoc;
  version: number;
}


orderSchema.set("versionKey", "version");
orderSchema.plugin(updateIfCurrentPlugin);
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20121.png")`,
    
      ], [
        `# Fixing some tests

2 - Fix up some tests - we are creating some Tickets in the Orders service 
  without providing them an ID Next Couple Videos 

adding to the tests for : delete, index, new and show.test.ts

import mongoose from 'mongoose';

and

id: mongoose.Types.ObjectId().toHexString(),

3 - Fix up some route handlers - we are publishing events around orders 
  but not providing the version of the order
`,`delete.test.ts, index.test.ts
---
it("marks an order as cancelled", async () => {
  // create a ticket with Ticket model
  const ticket = Ticket.build({
    id: mongoose.Types.ObjectId().toHexString(),
    title: "service",
    price: 20,
  });
  await ticket.save();
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20122.png")`,
    
      ], [
        `# Listeners in the Tickets Service

- Need to implement 2 Listeners for the Ticket Service

- 1 - for Order Created event - to lock down the ticket of the order !!

- 2 - for Order Cancelled event - the ticket should be unreserved

- similar to an On/Off flag


`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20125.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20124.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20123.png")`,
    
      ], [
        `# Building the Listener for the Tickets Service

- Created basic / stub listener
`,`order-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Listener, OrderCreatedEvent, Subjects } from "@w3ai/common";
import { queueGroupName } from "./queue-group-name";

export class OrderCreatedListener extends Listener<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {}
}

---`,
    
      ], [
        `# Strategies for Locking a Ticket

- simple boolean might not work

- no reporting info provided to the owner of the ticket / service 
  - who is buying, status, etc

- Solution: include the orderId associated with the ticket

- Tickets TicketId 'CZQ' orderId 'ADS' Is someone buying my ticket? 
Yes, the order ID is ADS Orders OrderId ADS status AwaitingPayment 
What's the status of order ADS? User who owns the ticket

- We can use the presence of an orderId to indicate if ticket is reserved or not !!

- by default tickets will be created with a null value for orderId 

- in the onMessage we can take the orderId and store in in the ticket record !!
  - also need to include orderId in ticket model !!
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20128.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20127.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%20126.png")`,
    
      ], [
        `# Implementing Reserving / Locking a Ticket

- 
`,`order-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Listener, OrderCreatedEvent, Subjects } from "@w3ai/common";
import { queueGroupName } from "./queue-group-name";
import { Ticket } from "../../models/ticket";

export class OrderCreatedListener extends Listener<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {
    // Find the ticket that the order is reserving
    const ticket = await Ticket.findById(data.ticket.id);

    // If no ticket, throw error
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Mark the ticket as being reserved by setting its orderId property
    ticket.set({ orderId: data.id });

    // Save the ticket
    await ticket.save();

    // ack the message
    msg.ack();
  }
}

---`,`order-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Listener, OrderCreatedEvent, Subjects } from "@w3ai/common";
import { queueGroupName } from "./queue-group-name";

export class OrderCreatedListener extends Listener<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent["data"], msg: Message) {
    // Find the ticket that the order is reserving

    // If no ticket, throw error

    // Mark the ticket as being reserved by setting its orderId property

    // Save the ticket

    // ack the message
    
  }
}

---`,
    
      ], [
        `# Setup() for Testing Reservation

- 
`,`order-created-listener.test.ts
---
import { Message } from "node-nats-streaming";
import mongoose from "mongoose";
import { OrderCreatedEvent, OrderStatus } from "@w3ai/common";
import { OrderCreatedListener } from "../order-created-listener";
import { natsWrapper } from "../../../nats-wrapper";
import { Ticket } from "../../../models/ticket";

const setup = async () => {
  // Create an instance of the listener
  const listener = new OrderCreatedListener(natsWrapper.client);

  // Create and save a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 99,
    userId: "asdf",
  });
  await ticket.save();

  // Create the fake data event
  const data: OrderCreatedEvent["data"] = {
    id: mongoose.Types.ObjectId().toHexString(),
    version: 0,
    status: OrderStatus.Created,
    userId: "alskdfj",
    expiresAt: "alskdjf",
    ticket: {
      id: ticket.id,
      price: ticket.price,
    },
  };

  // @ts-ignore
  const msg: Message = {
    ack: jest.fn(),
  };

  return { listener, ticket, data, msg };
};

---`,
    
      ]

    ]
  ]
}